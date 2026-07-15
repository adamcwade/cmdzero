// Text is data, not markup.
//
// <RevealWords text="..."/> renders {text} inside a span that lives in
// Reveal.tsx, so every heading on the site stamps as the same Reveal.tsx span.
// Editing there rewrites the shared component and changes the copy under every
// call site at once. The string being edited belongs to the call site's prop.
//
// The stamp alone can't say which call site rendered a given heading, so the
// overlay sends the clicked element's ancestor stamps: the nearest one from
// another file is the call site, and the component usage is looked up there.
// Style and structure edits still belong to the component — only text is
// redirected.
//
// Run: pnpm --filter cmdzero test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describeTarget, applyPropTextEdit } from '../src/resolver.js';

// The real RevealWords shape: the prop is read once for screen readers, then
// split into per-word spans for the animation. The words are what you can
// actually click — the sr-only copy is invisible.
const REVEAL = `export function RevealWords({ text, as = "h1" }) {
  const words = text.split(" ");
  return (
    <MotionTag>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <span key={i} className="inline-block">
            <MotionSpan className="inline-block">{word}</MotionSpan>
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </MotionTag>
  );
}
`;
const SPAN_LOC = 'components/Reveal.tsx:5:6'; // <span className="sr-only">{text}</span>
const WORDS_WRAP_LOC = 'components/Reveal.tsx:6:6'; // <span aria-hidden>{words.map(...)}</span>
const WORD_LOC = 'components/Reveal.tsx:8:10'; // <span key={i}> — one word; what you click

const CONTACT = `import { RevealWords } from "./Reveal";

export default function Contact() {
  return (
    <section id="contact">
      <div className="wrap">
        <RevealWords text="Let's ship something." as="h2" />
      </div>
    </section>
  );
}
`;

const HERO = `import { RevealWords } from "./Reveal";

export default function Hero() {
  return (
    <header>
      <RevealWords text="Zero to production." />
    </header>
  );
}
`;

// Ancestor stamps as the overlay would send them: nearest first.
const CONTACT_ANCESTORS = ['components/Contact.tsx:6:6', 'components/Contact.tsx:5:4'];
const HERO_ANCESTORS = ['components/Hero.tsx:5:4'];

function fixture(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdzero-textprop-'));
  fs.mkdirSync(path.join(root, 'components'));
  const files = { 'Reveal.tsx': REVEAL, 'Contact.tsx': CONTACT, 'Hero.tsx': HERO, ...extra };
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, 'components', name), body);
  }
  return root;
}

test('an element rendering {prop} reports the call site as its text source', () => {
  const root = fixture();

  const meta = describeTarget(root, SPAN_LOC, { ancestors: CONTACT_ANCESTORS });

  assert.equal(meta.textSource.value, "Let's ship something.");
  assert.equal(meta.textSource.file, 'components/Contact.tsx');
  assert.equal(meta.textSource.prop, 'text');
});

// The point of the whole feature: one stamp, two headings, two answers.
test('the same stamp resolves to different call sites', () => {
  const root = fixture();

  const fromContact = describeTarget(root, SPAN_LOC, { ancestors: CONTACT_ANCESTORS });
  const fromHero = describeTarget(root, SPAN_LOC, { ancestors: HERO_ANCESTORS });

  assert.equal(fromContact.textSource.value, "Let's ship something.");
  assert.equal(fromHero.textSource.value, 'Zero to production.');
});

test('editing the traced text rewrites only that call site', () => {
  const root = fixture();
  const meta = describeTarget(root, SPAN_LOC, { ancestors: CONTACT_ANCESTORS });

  applyPropTextEdit(root, meta.textSource.loc, 'text', "Let's ship something.", "Let's connect.");

  const contact = fs.readFileSync(path.join(root, 'components', 'Contact.tsx'), 'utf8');
  const hero = fs.readFileSync(path.join(root, 'components', 'Hero.tsx'), 'utf8');
  const reveal = fs.readFileSync(path.join(root, 'components', 'Reveal.tsx'), 'utf8');

  assert.match(contact, /text="Let's connect\."/);
  assert.match(hero, /text="Zero to production\."/, 'the other call site must be untouched');
  assert.equal(reveal, REVEAL, 'the shared component must not be rewritten');
});

// What you actually click. The animation splits the prop into a span per word,
// so the clicked element renders {word} — a map variable, one hop past {text}.
// The editable unit is still the whole heading: a word is not independently
// addressable in the source, the sentence is.
test('a word span traces through split/map back to the call site prop', () => {
  const root = fixture();

  const meta = describeTarget(root, WORD_LOC, { ancestors: CONTACT_ANCESTORS });

  assert.equal(meta.textSource?.value, "Let's ship something.");
  assert.equal(meta.textSource?.file, 'components/Contact.tsx');
  assert.equal(meta.textSource?.prop, 'text');
  assert.equal(meta.textSource?.wholeText, true, 'editing a word rewrites the whole sentence');
});

test('the words wrapper traces through split/map too', () => {
  const root = fixture();

  const meta = describeTarget(root, WORDS_WRAP_LOC, { ancestors: CONTACT_ANCESTORS });

  assert.equal(meta.textSource?.value, "Let's ship something.");
  assert.equal(meta.textSource?.wholeText, true);
});

test('a word span from the other call site traces to that call site', () => {
  const root = fixture();

  const meta = describeTarget(root, WORD_LOC, { ancestors: HERO_ANCESTORS });

  assert.equal(meta.textSource?.value, 'Zero to production.');
  assert.equal(meta.textSource?.file, 'components/Hero.tsx');
});

test('editing a word rewrites only that call site, not the shared component', () => {
  const root = fixture();
  const meta = describeTarget(root, WORD_LOC, { ancestors: CONTACT_ANCESTORS });

  applyPropTextEdit(root, meta.textSource.loc, 'text', "Let's ship something.", "Let's connect.");

  assert.match(fs.readFileSync(path.join(root, 'components', 'Contact.tsx'), 'utf8'), /text="Let's connect\."/);
  assert.match(fs.readFileSync(path.join(root, 'components', 'Hero.tsx'), 'utf8'), /text="Zero to production\."/);
  assert.equal(fs.readFileSync(path.join(root, 'components', 'Reveal.tsx'), 'utf8'), REVEAL);
});

test('a plain text literal is left alone — no tracing needed', () => {
  const root = fixture({
    'Plain.tsx': `export default function Plain() {
  return (
    <p className="x">hello</p>
  );
}
`,
  });

  const meta = describeTarget(root, 'components/Plain.tsx:3:4', { ancestors: [] });

  assert.equal(meta.texts.length, 1);
  assert.equal(meta.texts[0].value, 'hello');
  assert.equal(meta.textSource, null);
});

// Never guess: two usages in the call-site file means we cannot know which
// heading was clicked, so say so instead of editing the wrong one.
test('refuses to guess when the call-site file has two usages', () => {
  const root = fixture({
    'Twice.tsx': `import { RevealWords } from "./Reveal";

export default function Twice() {
  return (
    <section id="twice">
      <RevealWords text="First heading." />
      <RevealWords text="Second heading." />
    </section>
  );
}
`,
  });

  const meta = describeTarget(root, SPAN_LOC, { ancestors: ['components/Twice.tsx:5:4'] });

  assert.equal(meta.textSource, null);
  assert.match(meta.textSourceNote || '', /Twice\.tsx/);
  assert.match(meta.textSourceNote || '', /2 usages|two usages/i);
});
