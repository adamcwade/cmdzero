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
  // 0-based column) and the @tweaklocal/react dev runtime (absolute path,
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
  return { file, abs, content, element, ast };
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

/**
 * Merge CSS properties into the element's inline style prop — the
 * styling-system-agnostic edit lane (works with CSS modules, styled-components,
 * vanilla CSS, anything). styles: { camelCaseProp: value | null }, null removes.
 * Appended keys win in React's style object, so replacements are drop+append.
 */
export function applyStyleEdit(root, loc, styles) {
  const { abs, content, element } = loadTarget(root, loc);
  const opening = element.openingElement;
  const toSrc = (v) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`);
  const attr = opening.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name.name === 'style'
  );

  if (!attr) {
    const entries = Object.entries(styles).filter(([, v]) => v != null);
    if (!entries.length) return writeChecked(abs, content, content);
    const obj = entries.map(([k, v]) => `${k}: ${toSrc(v)}`).join(', ');
    const pos = opening.name.end;
    return writeChecked(
      abs,
      content,
      content.slice(0, pos) + ` style={{ ${obj} }}` + content.slice(pos)
    );
  }

  const expr =
    attr.value && attr.value.type === 'JSXExpressionContainer' ? attr.value.expression : null;
  if (!expr || expr.type !== 'ObjectExpression')
    throw new Error('style prop is not an object literal — describe the change instead');

  // Rebuild the object: keep untouched properties (and spreads) verbatim,
  // drop replaced/removed keys, append new values last.
  const parts = [];
  for (const p of expr.properties) {
    if (p.type === 'ObjectProperty' && !p.computed) {
      const name =
        p.key.type === 'Identifier' ? p.key.name : p.key.type === 'StringLiteral' ? p.key.value : null;
      if (name && name in styles) continue;
    }
    parts.push(content.slice(p.start, p.end));
  }
  for (const [k, v] of Object.entries(styles)) if (v != null) parts.push(`${k}: ${toSrc(v)}`);

  // Preserve multi-line formatting when the original object was multi-line.
  const original = content.slice(expr.start, expr.end);
  let objSrc;
  if (original.includes('\n') && expr.properties.length) {
    const firstProp = expr.properties[0];
    const lineStart = content.lastIndexOf('\n', firstProp.start) + 1;
    const indent = content.slice(lineStart, firstProp.start).match(/^\s*/)[0];
    const braceLineStart = content.lastIndexOf('\n', expr.end - 1) + 1;
    const braceIndent = content.slice(braceLineStart).match(/^\s*/)[0];
    objSrc = `{\n${indent}${parts.join(`,\n${indent}`)},\n${braceIndent}}`;
  } else {
    objSrc = `{ ${parts.join(', ')} }`;
  }
  return writeChecked(
    abs,
    content,
    content.slice(0, expr.start) + objSrc + content.slice(expr.end)
  );
}

// Remove an element from its source string, consuming its whole line(s) when
// it sits alone on them. Returns the new content, or null if unparseable.
function removeElementFromContent(content, element, file) {
  let start = element.start;
  let end = element.end;
  const lineStart = content.lastIndexOf('\n', start - 1) + 1;
  const afterMatch = content.slice(end).match(/^[ \t]*\n/);
  if (/^[ \t]*$/.test(content.slice(lineStart, start)) && afterMatch) {
    start = lineStart;
    end += afterMatch[0].length;
  }
  const next = content.slice(0, start) + content.slice(end);
  try {
    parseSource(next, file);
    return next;
  } catch {
    return null;
  }
}

// Ancestor chain from `element` up to the Program node (element first).
function ancestorChain(ast, element) {
  const chain = [];
  (function descend(node, trail) {
    if (!node || typeof node.type !== 'string') return false;
    if (node === element) {
      chain.push(element, ...trail);
      return true;
    }
    if (node.start > element.start || node.end < element.end) return false;
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const v = node[key];
      const kids = Array.isArray(v) ? v : [v];
      for (const kid of kids) {
        if (kid && typeof kid.type === 'string' && descend(kid, [node, ...trail])) return true;
      }
    }
    return false;
  })(ast, []);
  return chain;
}

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// If the chain shows `element` is the RETURNED VALUE of the innermost enclosing
// function (only Return/Block between them), return that function node.
// This gate matters: without it, a parse-breaking delete anywhere inside a
// named component would wrongly escalate to removing the component's usage.
function returningFunction(chain) {
  for (let i = 1; i < chain.length; i++) {
    const t = chain[i].type;
    if (t === 'ReturnStatement' || t === 'BlockStatement') continue;
    return FN_TYPES.has(t) ? chain[i] : null;
  }
  return null;
}

function nameOfFunction(ast, fn) {
  if (!fn) return null;
  if (fn.id && fn.id.name) return fn.id.name;
  let name = null;
  walk(ast, (n) => {
    if (
      n.type === 'VariableDeclarator' &&
      n.init && n.init.start === fn.start && n.init.end === fn.end &&
      n.id && n.id.type === 'Identifier'
    ) name = n.id.name;
  });
  return name;
}

// Walk up from the element looking for a `{...}` JSX expression whose whole
// removal parses — covers `{cond && <el/>}` (conditional) and `{arr.map(...)}`
// (list template: removing it removes the rendered list). Never crosses a
// function boundary except an inline callback (a function that is itself a
// call argument, e.g. the .map render callback).
function removableExpressionContainer(chain) {
  for (let i = 1; i < chain.length; i++) {
    const node = chain[i];
    if (node.type === 'JSXExpressionContainer') {
      const inner = chain[i - 1];
      const isList = FN_TYPES.has(inner?.type) || inner?.type === 'CallExpression';
      return { container: node, kind: isList ? 'list' : 'conditional block' };
    }
    if (FN_TYPES.has(node.type)) {
      // crossing a function is only allowed for inline callbacks (map etc.)
      const parent = chain[i + 1];
      if (!parent || parent.type !== 'CallExpression') return null;
    }
  }
  return null;
}

// Walk the project for JSX usages of <Name ...>. Returns [{file, element}].
function findUsages(root, name) {
  const usages = [];
  const skip = new Set(['node_modules', '.next', '.git', 'dist', '.turbo']);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) stack.push(full); continue; }
      if (!/\.(jsx|tsx)$/.test(e.name)) continue;
      let content, ast;
      try {
        content = fs.readFileSync(full, 'utf8');
        if (!content.includes('<' + name)) continue; // cheap prefilter
        ast = parseSource(content, e.name);
      } catch { continue; }
      walk(ast, (n) => {
        if (n.type !== 'JSXElement') return;
        const openName = n.openingElement.name;
        if (openName.type === 'JSXIdentifier' && openName.name === name) {
          usages.push({ file: path.relative(root, full), abs: full, content, element: n });
        }
      });
    }
  }
  return usages;
}

/**
 * Delete behavior, in order:
 *  1. Normal element (has siblings): remove it in place.
 *  2. Element inside a `{...}` JSX expression whose removal parses — a list
 *     template (`{arr.map(...)}`) or a conditional (`{cond && <el/>}`):
 *     remove the whole expression. Deleting a list template removes the
 *     rendered list — that's what the on-screen "container" is.
 *  3. Sole return of a NAMED component used in exactly one place: remove that
 *     usage at its call site.
 *  Otherwise refuse with an actionable message (ambiguous → model lane).
 */
export function applyDeleteElement(root, loc, { dryRun = false } = {}) {
  // reuse loadTarget's AST — element identity must hold for the ancestor walk
  const { abs, content, element, file, ast } = loadTarget(root, loc);

  const inPlace = removeElementFromContent(content, element, file);
  if (inPlace !== null) {
    if (dryRun) return { abs, before: content, after: inPlace, wouldWrite: false };
    return writeChecked(abs, content, inPlace);
  }

  // In-place removal breaks the file — walk up for a deletable wrapper.
  const chain = ancestorChain(ast, element);

  const wrapper = removableExpressionContainer(chain);
  if (wrapper) {
    const next = removeElementFromContent(content, wrapper.container, file);
    if (next !== null) {
      if (dryRun) return { abs, before: content, after: next, wouldWrite: false, removedBlock: wrapper.kind };
      return { ...writeChecked(abs, content, next), removedBlock: wrapper.kind };
    }
  }

  // Not a removable wrapper — usage removal, but ONLY when the element really
  // is the returned output of a named component.
  const fn = returningFunction(chain);
  const name = nameOfFunction(ast, fn);
  if (!name || !/^[A-Z]/.test(name)) {
    throw new Error(
      "can't delete this in place — it's the only thing rendered here and there's no removable wrapper. Describe the change instead (e.g. \"remove this from the list\") and it'll route through the model."
    );
  }

  const usages = findUsages(root, name).filter(
    (u) => !(u.abs === abs && u.element.start === element.start && u.element.end === element.end)
  );
  if (usages.length === 0) {
    throw new Error(
      `can't find where <${name}> is used, so there's no usage to remove. Describe the change instead and it'll route through the model.`
    );
  }
  if (usages.length > 1) {
    throw new Error(
      `<${name}> is used in ${usages.length} places — deleting one is ambiguous. Select the specific <${name}> instance you want removed, or describe the change.`
    );
  }

  const usage = usages[0];
  const removed = removeElementFromContent(usage.content, usage.element, usage.file);
  if (removed === null) {
    throw new Error(
      `removing the <${name}> usage would break ${usage.file}. Describe the change instead.`
    );
  }
  if (dryRun) return { abs: usage.abs, before: usage.content, after: removed, wouldWrite: false, removedUsage: name };
  return { ...writeChecked(usage.abs, usage.content, removed), removedUsage: name };
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
