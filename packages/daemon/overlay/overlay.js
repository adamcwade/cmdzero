// fastui overlay — injected into the app in dev. Vanilla JS, no deps.
(() => {
  if (window.__FASTUI__) return;
  window.__FASTUI__ = true;

  const script = [...document.scripts].find((s) => /\/overlay\.js/.test(s.src));
  const ORIGIN = window.FASTUI_ORIGIN || (script ? new URL(script.src).origin : 'http://localhost:4100');

  const PAD_SCALE = ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24'];
  const FONT_SCALE = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl'];

  const css = `
  #fui-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:ui-sans-serif,system-ui,sans-serif}
  .fui-outline{position:fixed;border:1.5px solid #6366f1;border-radius:3px;background:rgba(99,102,241,.08);pointer-events:none;transition:all .04s linear}
  .fui-outline.fui-selected{border-color:#10b981;background:rgba(16,185,129,.06)}
  .fui-badge{position:fixed;background:#312e81;color:#e0e7ff;font-size:11px;padding:2px 7px;border-radius:4px;pointer-events:none;white-space:nowrap;transform:translateY(-100%)}
  .fui-pop{position:fixed;background:#111827;color:#f9fafb;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.35);padding:8px;pointer-events:auto;display:flex;flex-direction:column;gap:6px;min-width:280px;font-size:12px}
  .fui-row{display:flex;gap:6px;align-items:center}
  .fui-pop button{background:#374151;color:#f9fafb;border:none;border-radius:6px;padding:4px 9px;font-size:12px;cursor:pointer}
  .fui-pop button:hover{background:#4b5563}
  .fui-pop button.fui-primary{background:#6366f1}
  .fui-pop input{flex:1;background:#1f2937;border:1px solid #374151;border-radius:6px;color:#f9fafb;padding:5px 8px;font-size:12px;outline:none}
  .fui-label{color:#9ca3af;min-width:52px}
  .fui-tray{position:fixed;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;pointer-events:auto;max-width:340px}
  .fui-tweak{background:#111827;color:#e5e7eb;border-radius:8px;padding:6px 10px;font-size:11.5px;display:flex;gap:8px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.3)}
  .fui-dot{width:8px;height:8px;border-radius:50%;flex:none}
  .fui-dot.done{background:#10b981}.fui-dot.queued,.fui-dot.running{background:#f59e0b;animation:fui-pulse 1s infinite}.fui-dot.error{background:#ef4444}.fui-dot.reverted{background:#6b7280}
  .fui-tweak button{background:none;border:none;color:#818cf8;cursor:pointer;font-size:11px;padding:0}
  .fui-meta{color:#9ca3af}
  .fui-hint{position:fixed;left:14px;bottom:14px;background:#111827;color:#9ca3af;font-size:11px;padding:5px 10px;border-radius:6px;pointer-events:none}
  [contenteditable="plaintext-only"],[contenteditable="true"]{outline:2px dashed #10b981;outline-offset:2px}
  @keyframes fui-pulse{50%{opacity:.4}}`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'fui-root';
  document.body.appendChild(root);

  const state = {
    selectMode: false,
    hoverEl: null,
    selected: null, // { el, loc }
    editing: null, // { el, original }
  };

  // ---------- helpers ----------
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const api = async (p, body) => {
    const r = await fetch(`${ORIGIN}/api/${p}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j && j.ok === false) throw new Error(j.error);
    return j;
  };
  const inOverlay = (t) => t instanceof Node && root.contains(t);
  const classList = (e) => (e.getAttribute('class') || '').split(/\s+/).filter(Boolean);

  function positionBox(box, target) {
    const r = target.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    return r;
  }

  // ---------- hover ----------
  const hoverBox = el('div', 'fui-outline');
  const hoverBadge = el('div', 'fui-badge');
  hoverBox.style.display = hoverBadge.style.display = 'none';
  root.append(hoverBox, hoverBadge);

  function setHover(target) {
    state.hoverEl = target;
    if (!target || target === state.selected?.el) {
      hoverBox.style.display = hoverBadge.style.display = 'none';
      return;
    }
    hoverBox.style.display = hoverBadge.style.display = 'block';
    const r = positionBox(hoverBox, target);
    hoverBadge.textContent = `<${target.tagName.toLowerCase()}> ${target.getAttribute('data-fui')}`;
    Object.assign(hoverBadge.style, { left: r.left + 'px', top: Math.max(r.top - 4, 16) + 'px' });
  }

  // ---------- selection ----------
  const selBox = el('div', 'fui-outline fui-selected');
  selBox.style.display = 'none';
  root.appendChild(selBox);
  const pop = el('div', 'fui-pop');
  pop.style.display = 'none';
  root.appendChild(pop);

  function select(target) {
    finishTextEdit(false);
    const loc = target.getAttribute('data-fui');
    state.selected = { el: target, loc };
    selBox.style.display = 'block';
    renderPopover();
    reposition();
  }

  function deselect() {
    finishTextEdit(false);
    state.selected = null;
    selBox.style.display = 'none';
    pop.style.display = 'none';
  }

  function reposition() {
    const s = state.selected;
    if (!s) return;
    if (!document.contains(s.el)) {
      // HMR replaced the node — re-acquire by stamp
      const again = document.querySelector(`[data-fui="${CSS.escape(s.loc)}"]`);
      if (!again) return deselect();
      s.el = again;
    }
    const r = positionBox(selBox, s.el);
    pop.style.display = 'flex';
    const top = r.bottom + 8 + pop.offsetHeight > innerHeight ? r.top - pop.offsetHeight - 8 : r.bottom + 8;
    Object.assign(pop.style, { left: Math.min(r.left, innerWidth - 320) + 'px', top: Math.max(top, 8) + 'px' });
  }

  // ---------- popover ----------
  function hasEditableText(target) {
    return target.children.length === 0 && target.textContent.trim().length > 0;
  }

  function scaleStep(target, regexOrList, scale, prefix, dir, fallback) {
    const classes = classList(target);
    let current = classes.find((c) => (Array.isArray(regexOrList) ? regexOrList.includes(c) : regexOrList.test(c)));
    let idx = current
      ? scale.indexOf(Array.isArray(regexOrList) ? current : current.slice(prefix.length))
      : scale.indexOf(fallback);
    const next = Math.min(Math.max(idx + dir, 0), scale.length - 1);
    if (next === idx && current) return null;
    const add = Array.isArray(regexOrList) ? scale[next] : prefix + scale[next];
    return { remove: current ? [current] : [], add: [add] };
  }

  async function applyClassTweak(change, label) {
    if (!change) return;
    const s = state.selected;
    change.remove.forEach((c) => s.el.classList.remove(c)); // optimistic
    change.add.forEach((c) => s.el.classList.add(c));
    reposition();
    try {
      await api('edit-class', { loc: s.loc, remove: change.remove, add: change.add });
    } catch (e) {
      addTweak({ id: 'x' + Date.now(), status: 'error', label: `${label}: ${e.message}` });
    }
    setTimeout(reposition, 350); // after HMR
  }

  function renderPopover() {
    const s = state.selected;
    pop.textContent = '';

    const head = el('div', 'fui-row');
    head.append(el('span', 'fui-meta', s.loc));
    pop.appendChild(head);

    if (hasEditableText(s.el)) {
      const row = el('div', 'fui-row');
      row.append(el('span', 'fui-label', 'Copy'));
      const b = el('button', null, '✎ Edit text in place');
      b.onclick = () => startTextEdit();
      row.appendChild(b);
      pop.appendChild(row);
    }

    const padRow = el('div', 'fui-row');
    padRow.append(el('span', 'fui-label', 'Padding'));
    const padMinus = el('button', null, '−');
    const padPlus = el('button', null, '+');
    padMinus.onclick = () => applyClassTweak(scaleStep(s.el, /^p-(\d+(\.\d+)?)$/, PAD_SCALE, 'p-', -1, '0'), 'padding');
    padPlus.onclick = () => applyClassTweak(scaleStep(s.el, /^p-(\d+(\.\d+)?)$/, PAD_SCALE, 'p-', +1, '0'), 'padding');
    padRow.append(padMinus, padPlus);

    padRow.append(el('span', 'fui-label', 'Font'));
    const fMinus = el('button', null, 'A−');
    const fPlus = el('button', null, 'A+');
    fMinus.onclick = () => applyClassTweak(scaleStep(s.el, FONT_SCALE, FONT_SCALE, '', -1, 'text-base'), 'font');
    fPlus.onclick = () => applyClassTweak(scaleStep(s.el, FONT_SCALE, FONT_SCALE, '', +1, 'text-base'), 'font');
    padRow.append(fMinus, fPlus);
    pop.appendChild(padRow);

    const nlRow = el('div', 'fui-row');
    const input = el('input');
    input.placeholder = 'Describe a change… (routed to the right model)';
    const go = el('button', 'fui-primary', 'Go');
    const send = async () => {
      const instruction = input.value.trim();
      if (!instruction) return;
      input.value = '';
      try {
        const r = await api('nl', { loc: s.loc, instruction });
        addTweak({ id: r.id, status: 'queued', model: r.model, label: instruction.slice(0, 60) });
      } catch (e) {
        addTweak({ id: 'x' + Date.now(), status: 'error', label: e.message });
      }
    };
    go.onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); };
    nlRow.append(input, go);
    pop.appendChild(nlRow);
  }

  // ---------- inline copy editing ----------
  function startTextEdit() {
    const s = state.selected;
    state.editing = { el: s.el, original: s.el.textContent };
    try { s.el.contentEditable = 'plaintext-only'; } catch { s.el.contentEditable = 'true'; }
    s.el.focus();
    document.getSelection()?.selectAllChildren(s.el);
  }

  async function finishTextEdit(commit) {
    const ed = state.editing;
    if (!ed) return;
    state.editing = null;
    ed.el.contentEditable = 'false';
    ed.el.removeAttribute('contenteditable');
    const newText = ed.el.textContent.trim();
    if (!commit || newText === ed.original.trim()) {
      ed.el.textContent = ed.original;
      return;
    }
    try {
      await api('edit-text', { loc: state.selected.loc, oldText: ed.original, newText });
    } catch (e) {
      ed.el.textContent = ed.original;
      addTweak({ id: 'x' + Date.now(), status: 'error', label: `copy: ${e.message}` });
    }
    setTimeout(reposition, 350);
  }

  // ---------- tray ----------
  const tray = el('div', 'fui-tray');
  root.appendChild(tray);
  const tweaks = new Map();

  function addTweak(t) {
    let row = tweaks.get(String(t.id));
    if (!row) {
      row = el('div', 'fui-tweak');
      row._dot = el('span', 'fui-dot');
      row._label = el('span', null, '');
      row._meta = el('span', 'fui-meta', '');
      row._undo = el('button', null, 'undo');
      row._undo.style.display = 'none';
      row._undo.onclick = async () => {
        try {
          await api('undo', { id: t.id });
          setTimeout(reposition, 350);
        } catch (e) { row._meta.textContent = e.message; }
      };
      row.append(row._dot, row._label, row._meta, row._undo);
      tray.prepend(row);
      tweaks.set(String(t.id), row);
      while (tray.children.length > 6) tray.lastChild.remove();
    }
    if (t.label) row._label.textContent = t.label;
    if (t.status) {
      row._dot.className = 'fui-dot ' + t.status;
      row._undo.style.display = t.status === 'done' && !String(t.id).startsWith('x') ? '' : 'none';
    }
    const bits = [];
    if (t.model) bits.push(t.model);
    if (t.tokens === 0) bits.push('0 tokens');
    if (t.durationMs) bits.push((t.durationMs / 1000).toFixed(1) + 's');
    if (t.costUSD != null) bits.push('$' + t.costUSD.toFixed(3));
    if (t.error) bits.push(t.error.slice(0, 80));
    if (bits.length) row._meta.textContent = bits.join(' · ');
  }

  try {
    const es = new EventSource(`${ORIGIN}/api/events`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === 'tweak') addTweak(e);
    };
  } catch { /* daemon offline */ }

  // ---------- mode + events ----------
  const hint = el('div', 'fui-hint', '⌘. select mode');
  root.appendChild(hint);

  function setMode(on) {
    state.selectMode = on;
    hint.textContent = on ? 'select mode — click an element · Esc to exit' : '⌘. select mode';
    if (!on) { setHover(null); deselect(); }
  }

  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '.') {
      e.preventDefault();
      setMode(!state.selectMode);
      return;
    }
    if (!state.selectMode) return;
    if (e.key === 'Escape') {
      if (state.editing) return finishTextEdit(false);
      if (state.selected) return deselect();
      return setMode(false);
    }
    if (e.key === 'Enter' && state.editing) {
      e.preventDefault();
      finishTextEdit(true);
    }
  }, true);

  addEventListener('mousemove', (e) => {
    if (!state.selectMode || state.editing) return;
    if (inOverlay(e.target)) return setHover(null);
    setHover(e.target instanceof Element ? e.target.closest('[data-fui]') : null);
  }, true);

  addEventListener('click', (e) => {
    if (!state.selectMode) return;
    if (inOverlay(e.target)) return;
    if (state.editing) return; // clicks inside editable text are fine
    e.preventDefault();
    e.stopPropagation();
    const target = e.target instanceof Element ? e.target.closest('[data-fui]') : null;
    if (target) select(target);
    else deselect();
  }, true);

  addEventListener('scroll', () => { reposition(); setHover(state.hoverEl); }, true);
  addEventListener('resize', () => reposition());
})();
