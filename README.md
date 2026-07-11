# fastui (working name)

Tweak your UI live in the browser. Select any element, edit copy in place, nudge styles, or describe a change — fastui knows exactly which source file and line each element came from, so most tweaks cost **zero tokens** and the rest run through a model sized to the job.

## How it works

- **`@fastui/babel-plugin`** stamps every host JSX element with `data-fui="<file>:<line>:<col>"` in dev builds. Deterministic mapping — no AI guessing, works with server components.
- **`@fastui/daemon`** (`node packages/daemon/bin/fastui.js`) runs beside your dev server:
  - resolves a stamp to the exact AST node (element span, text literals, className) via `@babel/parser`
  - **copy edits** and **Tailwind class edits** are written straight to source — 0 tokens
  - **natural-language tweaks** are classified (style/copy → `haiku`, functionality → `sonnet`, override with `FASTUI_FAST_MODEL` / `FASTUI_SMART_MODEL`) and executed by spawning headless `claude -p` scoped to the one mapped file
  - per-tweak undo, SSE status events
- **Overlay** (served by the daemon, injected by Vite in dev): `⌘.` toggles select mode → hover badges → click to select → popover with copy/style/NL controls → tweak tray with model, duration, cost, and undo.

## Run the demo

```sh
pnpm install
cd apps/demo && node ../../packages/daemon/bin/fastui.js &   # daemon on :4100
pnpm --filter demo dev                                        # vite on :5173
```

Open http://localhost:5173, press `⌘.`, click anything.

## Layout

- `packages/babel-plugin-fastui` — source stamping
- `packages/daemon` — resolver, model router, HTTP/SSE server, overlay assets
- `apps/demo` — Vite + React + Tailwind test bed

## Roadmap

- Next.js adapter (Turbopack-compatible stamping), attached-agent mode via MCP, blast-radius scope prompt (instance vs shared component), CSS-modules/styled-components attribution, git-checkpoint undo, benchmark harness (tokens/latency vs vanilla agent edits).
