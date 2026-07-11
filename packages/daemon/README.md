# fastui

Tweak your UI live in the browser — the changes are written straight to your source files.

- **Copy**: click any text, edit in place, Enter. Written to the JSX literal. 0 tokens.
- **Style**: padding/margin per side, font sizes and colors from *your* design system tokens. Deterministic Tailwind class edits. 0 tokens.
- **Anything else**: describe it — routed to a fast model for style/copy or a reasoning model for functionality (headless `claude -p`), scoped to the exact file your selection maps to.

## Quickstart (Next.js)

```sh
npm i -D fastui @fastui/react
```

1. `jsconfig.json` / `tsconfig.json`:
   ```json
   { "compilerOptions": { "jsxImportSource": "@fastui/react" } }
   ```
2. Root layout:
   ```jsx
   import { FastUIOverlay } from '@fastui/react';
   // inside <body>: {children}<FastUIOverlay />
   ```
3. Run the daemon next to your dev server, from the project root:
   ```sh
   npx fastui
   ```
4. Open your app, press `⌘.`, click anything.

Works with Turbopack, webpack, and Vite — stamping happens in React's dev JSX runtime, not the bundler. Server components included. Production builds are untouched (the prod runtime is a passthrough).

## Options

- `npx fastui --port 4101` (+ `<FastUIOverlay origin="http://localhost:4101" />`)
- `FASTUI_FAST_MODEL` / `FASTUI_SMART_MODEL` — model aliases for the router (default `haiku` / `sonnet`)
- `FASTUI_BASELINE_COST` / `FASTUI_BASELINE_MS` — baseline for the savings counter
- Natural-language tweaks require the [Claude Code CLI](https://claude.com/claude-code) (`claude`) on your PATH; copy/style lanes work without it.
