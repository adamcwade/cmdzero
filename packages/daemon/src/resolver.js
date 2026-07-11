import { parse } from '@babel/parser';
import fs from 'node:fs';
import path from 'node:path';

function parseSource(content, file) {
  const plugins = /\.tsx?$/.test(file) ? ['typescript', 'jsx'] : ['jsx'];
  return parse(content, { sourceType: 'module', plugins, errorRecovery: true });
}

function walk(node, cb) {
  if (!node || typeof node.type !== 'string') return;
  cb(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, cb));
    else if (v && typeof v.type === 'string') walk(v, cb);
  }
}

/** loc format: "<relative file>:<line 1-based>:<col 0-based>" (matches the babel stamp) */
export function parseLoc(loc) {
  const m = /^(.*):(\d+):(\d+)$/.exec(loc);
  if (!m) throw new Error(`bad loc: ${loc}`);
  return { file: m[1], line: Number(m[2]), col: Number(m[3]) };
}

export function loadTarget(root, loc) {
  const parsed = parseLoc(loc);
  const { line, col } = parsed;
  // Stamps come from two sources: the babel plugin (root-relative path,
  // 0-based column) and the @fastui/react dev runtime (absolute path,
  // 1-based column). Normalize the path and match either column convention.
  const file = path.isAbsolute(parsed.file)
    ? path.relative(root, parsed.file)
    : parsed.file;
  if (file.startsWith('..')) throw new Error('file outside root');
  const abs = path.resolve(root, file);
  const content = fs.readFileSync(abs, 'utf8');
  const ast = parseSource(content, file);
  let element = null;
  let nearMiss = null;
  walk(ast, (n) => {
    if (n.type !== 'JSXElement' || !n.openingElement.loc) return;
    const s = n.openingElement.loc.start;
    if (s.line !== line) return;
    if (s.column === col) element = n;
    else if (s.column === col - 1 && !nearMiss) nearMiss = n;
  });
  element = element || nearMiss;
  if (!element) throw new Error(`no JSX element at ${loc}`);
  return { file, abs, content, element };
}

export function describeTarget(root, loc) {
  const { file, content, element } = loadTarget(root, loc);
  const opening = element.openingElement;
  const texts = element.children
    .filter((c) => c.type === 'JSXText' && c.value.trim())
    .map((c) => ({ value: c.value.trim(), start: c.start, end: c.end }));
  const classAttr = opening.attributes.find(
    (a) =>
      a.type === 'JSXAttribute' &&
      a.name.name === 'className' &&
      a.value &&
      a.value.type === 'StringLiteral'
  );
  return {
    file,
    tagName: opening.name.name,
    span: { start: element.start, end: element.end },
    lines: { start: element.loc.start.line, end: element.loc.end.line },
    snippet: content.slice(element.start, element.end),
    texts,
    className: classAttr ? classAttr.value.value : null,
  };
}

export function applyTextEdit(root, loc, oldText, newText) {
  const { abs, content, element } = loadTarget(root, loc);
  const node = element.children.find(
    (c) => c.type === 'JSXText' && c.value.trim() === oldText.trim()
  );
  if (!node) throw new Error(`text "${oldText}" not found in element at ${loc}`);
  const raw = content.slice(node.start, node.end);
  const leading = raw.match(/^\s*/)[0];
  const trailing = raw.match(/\s*$/)[0];
  const next =
    content.slice(0, node.start) + leading + newText + trailing + content.slice(node.end);
  return writeChecked(abs, content, next);
}

export function applyClassEdit(root, loc, removes = [], adds = []) {
  const { abs, content, element } = loadTarget(root, loc);
  const opening = element.openingElement;
  const attr = opening.attributes.find(
    (a) =>
      a.type === 'JSXAttribute' &&
      a.name.name === 'className' &&
      a.value &&
      a.value.type === 'StringLiteral'
  );
  let next;
  if (attr) {
    let classes = attr.value.value.split(/\s+/).filter(Boolean);
    classes = classes.filter((c) => !removes.includes(c));
    for (const a of adds) if (!classes.includes(a)) classes.push(a);
    next =
      content.slice(0, attr.value.start + 1) +
      classes.join(' ') +
      content.slice(attr.value.end - 1);
  } else {
    const pos = opening.name.end;
    next =
      content.slice(0, pos) + ` className="${adds.join(' ')}"` + content.slice(pos);
  }
  return writeChecked(abs, content, next);
}

/** Returns null if the file parses, else the parse error message. */
export function checkSyntax(root, file) {
  const abs = path.resolve(root, file);
  try {
    parseSource(fs.readFileSync(abs, 'utf8'), file);
    return null;
  } catch (e) {
    return e.message;
  }
}

function writeChecked(abs, before, after) {
  fs.writeFileSync(abs, after);
  return { abs, before, after };
}
