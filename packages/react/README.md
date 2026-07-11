# @tweaklocal/react

Dev-time JSX source stamping for [TweakLocal](https://www.npmjs.com/package/tweaklocal).

Set `"jsxImportSource": "@tweaklocal/react"` in your ts/jsconfig and every rendered host element carries `data-twk="<file>:<line>:<col>"` in development — the ground truth the TweakLocal overlay and daemon use to map any pixel back to its exact JSX expression.

- Bundler-agnostic: Turbopack, webpack, Vite, esbuild — anything that emits the standard `jsxDEV` dev runtime calls.
- Server components supported (the attribute serializes to HTML).
- Zero production impact: the prod `jsx-runtime` is a passthrough and prod builds carry no source info.

Also exports `<TweakLocalOverlay />` — drop it at the end of your root layout to load the TweakLocal overlay in dev (renders nothing in production).
