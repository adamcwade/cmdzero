// The contract between the daemon and the collector.
//
// v0.8.1 is published; its wire format can never change. These tests pin that
// format AND run it through the collector's real validator, so the two halves
// can't drift apart in silence — which is exactly how the endpoint came to be
// pointed at a domain that didn't exist.
//
// Run: pnpm --filter cmdzero test
import test, { before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The collector's whitelist, imported directly across the workspace. If this
// import breaks, the contract has broken with it.
import { validate } from '../../../apps/telemetry/lib/schema.js';

const BOOT_KEYS = ['anonymousId', 'event', 'node', 'platform', 'tailwind', 'ts', 'version'];

let server;
let received;
let tmpHome;
let initTelemetry;

async function waitForRequest(timeoutMs = 3000) {
  const started = Date.now();
  while (received.length === 0) {
    if (Date.now() - started > timeoutMs) throw new Error('no request arrived');
    await new Promise((r) => setTimeout(r, 20));
  }
  return received[0];
}

async function expectNoRequest(windowMs = 300) {
  await new Promise((r) => setTimeout(r, windowMs));
  assert.equal(received.length, 0, `expected zero requests, got ${received.length}`);
}

before(async () => {
  received = [];
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, body: JSON.parse(body) });
      res.statusCode = 202;
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));

  // Both are read at module load, so they must be set before the import below.
  // HOME redirects the anonymousId config away from the real ~/.cmdzero.
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdzero-telemetry-test-'));
  process.env.HOME = tmpHome;
  process.env.CMDZERO_TELEMETRY_URL = `http://127.0.0.1:${server.address().port}/v1/events`;
  ({ initTelemetry } = await import('../src/telemetry.js'));
});

after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

beforeEach(() => {
  received.length = 0;
  delete process.env.CMDZERO_TELEMETRY;
  delete process.env.DO_NOT_TRACK;
});

test('boot sends the frozen wire format, and the collector accepts it', async () => {
  const telemetry = initTelemetry({ version: '9.9.9', tailwind: true });
  telemetry.start();

  const req = await waitForRequest();
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/v1/events');

  // Exact keys: an extra field is a disclosure change, not a refactor.
  assert.deepEqual(Object.keys(req.body).sort(), BOOT_KEYS);
  assert.equal(req.body.event, 'boot');
  assert.equal(req.body.version, '9.9.9');
  assert.equal(req.body.tailwind, true);
  assert.equal(req.body.node, process.version);
  assert.equal(req.body.platform, os.platform());
  assert.ok(Number.isFinite(req.body.ts));

  const result = validate(req.body);
  assert.ok(result.ok, `collector rejected a real boot payload: ${result.error}`);
  assert.equal(result.row.event, 'boot');
  assert.equal(result.row.counts, null);
});

test('tweaks flush sends per-lane counts the collector accepts', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const telemetry = initTelemetry({ version: '9.9.9', tailwind: false });
  telemetry.record('copy');
  telemetry.record('copy');
  telemetry.record('style');
  mock.timers.tick(60_000); // FLUSH_MS
  mock.timers.reset(); // real timers back before we poll

  const req = await waitForRequest();
  assert.equal(req.body.event, 'tweaks');
  assert.deepEqual(req.body.counts, { copy: 2, style: 1, delete: 0, nl: 0, move: 0, deploy: 0 });

  const result = validate(req.body);
  assert.ok(result.ok, `collector rejected a real tweaks payload: ${result.error}`);
  assert.equal(result.row.counts.copy, 2);
  assert.equal(result.row.counts.style, 1);
});

test('CMDZERO_TELEMETRY=0 sends nothing', async () => {
  process.env.CMDZERO_TELEMETRY = '0';
  const telemetry = initTelemetry({ version: '9.9.9', tailwind: true });
  telemetry.start();
  telemetry.record('copy');
  await expectNoRequest();
  assert.equal(telemetry.disabled, true);
});

test('DO_NOT_TRACK=1 sends nothing', async () => {
  process.env.DO_NOT_TRACK = '1';
  const telemetry = initTelemetry({ version: '9.9.9', tailwind: true });
  telemetry.start();
  telemetry.record('copy');
  await expectNoRequest();
  assert.equal(telemetry.disabled, true);
});

test('a dead endpoint is recorded, not thrown', async () => {
  // Nothing listens on port 9. The daemon must survive this — the terminal
  // .catch() in send() is the only thing standing between a network failure and
  // an unhandled rejection that kills the process.
  const telemetry = initTelemetry({ version: '9.9.9', tailwind: true });
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('getaddrinfo ENOTFOUND'));
  try {
    telemetry.start();
    await new Promise((r) => setTimeout(r, 100));
    const { lastError } = telemetry.status();
    assert.ok(lastError, 'expected the failure to be recorded');
    assert.match(lastError.message, /boot: getaddrinfo ENOTFOUND/);
  } finally {
    globalThis.fetch = original;
  }
});
