// Stamp path formats the resolver has to understand.
//
// There are three, not two. The babel plugin emits a root-relative path; the
// @cmdzero/react dev runtime emits whatever the bundler put in jsxDEV's source
// info — which is absolute under webpack but "[project]/..." under Turbopack.
// Next.js 16 made Turbopack the default, so every Next 16 user hit
// ENOENT '<root>/[project]/components/Foo.tsx' on their first edit while the
// copy and style lanes looked fine right up until the write.
//
// apps/demo-next pins Next 15 (webpack by default), which is why the demo
// never reproduced it.
//
// Run: pnpm --filter cmdzero test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadTarget } from '../src/resolver.js';

const SOURCE = `export default function Foo() {
  return (
    <div className="wrap">
      <p>hello</p>
    </div>
  );
}
`;

// The <p> opens on line 4, column 6.
const P_LINE = 4;
const P_COL = 6;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdzero-resolver-'));
  fs.mkdirSync(path.join(root, 'components'));
  fs.writeFileSync(path.join(root, 'components', 'Foo.tsx'), SOURCE);
  return root;
}

test('resolves a Turbopack "[project]/" stamp', () => {
  const root = fixture();
  const target = loadTarget(root, `[project]/components/Foo.tsx:${P_LINE}:${P_COL}`);

  assert.equal(target.element.openingElement.name.name, 'p');
  assert.equal(target.abs, path.join(root, 'components', 'Foo.tsx'));
});

test('a Turbopack stamp resolves to the same element as an absolute stamp', () => {
  const root = fixture();
  const abs = path.join(root, 'components', 'Foo.tsx');

  const viaAbsolute = loadTarget(root, `${abs}:${P_LINE}:${P_COL}`);
  const viaTurbopack = loadTarget(root, `[project]/components/Foo.tsx:${P_LINE}:${P_COL}`);

  assert.equal(viaTurbopack.abs, viaAbsolute.abs);
  assert.equal(viaTurbopack.element.start, viaAbsolute.element.start);
});

test('still resolves a root-relative babel stamp', () => {
  const root = fixture();
  const target = loadTarget(root, `components/Foo.tsx:${P_LINE}:${P_COL}`);

  assert.equal(target.element.openingElement.name.name, 'p');
});

// Stripping the prefix must not open a hole in the escape guard: a stamp that
// climbs out of the root is still refused, prefixed or not.
test('refuses a "[project]/" stamp that escapes the root', () => {
  const root = fixture();

  assert.throws(
    () => loadTarget(root, '[project]/../../../etc/passwd:1:0'),
    /file outside root/,
  );
});
