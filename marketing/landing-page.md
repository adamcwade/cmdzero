# CmdZero — Landing Page Copy

> Voice notes: written for frontend developers who already use AI coding agents. Direct, technical, lightly wry. No buzzwords, no exclamation points, every claim backed by a mechanism or a number. Headlines can be bold; body copy stays precise. "We/your" voice, present tense.

---

## Above the fold

**Headline:**
# Stop describing your UI to an AI. Point at it.

**Subheadline:**
CmdZero maps every element in your running app to its exact line of source. Click the thing, change the thing — copy, style, and structure edits land in your code instantly, with zero AI involved. The rest goes to a model sized for the job.

**Primary CTA:** `npm i -D cmdzero @cmdzero/react` *(copy-to-clipboard button)*

**Secondary CTA:** [▶︎ Try the live demo — no install](https://cmdzero.xyz/demo)

**Tertiary:** Star on GitHub

**Hero visual:** 20-second screen recording — press `⌘0` (the overlay sweeps once and settles into its ring), select headline, edit text in place, nudge padding, drag a card into a new position, type "make this button feel premium," savings counter ticking in the banner.

*(The live demo is the real overlay running entirely in the browser — copy, style, reorder, delete and undo all work; NL prompts are scripted and nothing is written to disk. It's the strongest asset we have for cold traffic: no install, no signup, hands on the product in one click.)*

---

## Stat strip (below hero)

**0 tokens** — for copy, style, and structure tweaks · **69% cheaper** — same edits vs. an unscoped agent session · **60% fewer tokens** — across the same task set · **2× faster** — 72s → 34s end to end

*(Numbers from the [benchmark](../packages/benchmark/results.md): 495,271 → 195,780 tokens, $0.375 → $0.118, four representative tasks. Update with real-repo results before launch.)*

---

## Problem section

### The 40-second padding tweak

You know this loop. You tell your agent "a bit more padding on the pricing card." It greps the repo. Reads four files. Thinks. Twenty seconds and 137,000 tokens later, it edits the right one — probably. Then you look at the result and say "hmm, a bit less."

You just paid twice for an edit you could describe with one keystroke — if your tools knew *which* card, in *which* file, on *which* line.

CmdZero knows. That's the whole product.

---

## How it works

### Three steps, ninety seconds

**1. Install**
```sh
npm i -D cmdzero @cmdzero/react
```

**2. Point React's dev runtime at CmdZero**
```json
// tsconfig.json or jsconfig.json
{ "compilerOptions": { "jsxImportSource": "@cmdzero/react" } }
```
```jsx
// app/layout.tsx — at the end of <body>
import { CmdZeroOverlay } from '@cmdzero/react';
<CmdZeroOverlay />
```

**3. Run it next to your dev server**
```sh
npx cmdzero
```

Open your app and press `⌘0`. A light sweeps the page once and a quiet ring holds at the edge — the overlay is armed and listening. Click anything.

*No bundler config. Works with Turbopack, webpack, and Vite — stamping happens in React's dev JSX runtime, so server components map too. Production builds get a passthrough: zero bytes, zero overhead.*

---

## The four lanes

### Copy: click, type, done
Click any text and edit it in place. Enter writes it to the JSX literal — the actual source file, not a CMS shadow copy. Text lands on the **call site**, so a string passed into a shared component edits *your* usage, not the component every other page depends on. **0 tokens, 0 API calls.**

### Style: your design system, on tap
Padding and margin per side. Font sizes and color swatches read from *your* theme — the tokens your app actually uses, not a generic picker. On Tailwind projects it's a deterministic class edit; everywhere else it's a deterministic inline-style edit on a px scale. Either way it's your source, and either way it's **0 tokens.**

### Structure: reorder, delete, do it to twenty at once
Every selected section or card gets a move toolbar — arrows (`↑↓` for columns, `←→` for rows) or drag the `⠿` grip. Cards rendered from a `.map()` reorder the backing array; written-out siblings swap in place; a section's outer container moves the whole `<Section/>` among its siblings. Shift-click to select many elements and apply one instruction — or one delete — to all of them. **0 tokens.**

### Everything else: describe it, routed right
"Make this button show a confirmation state when clicked." A layered router picks a model *and* an effort level sized to the request, then runs headless `claude -p` scoped to the one file your selection maps to. No repo search, no context bloat. It validates the edit still parses, retries once if not, and reverts rather than leave your app broken.

---

## Model routing

### The cheapest model that can actually do it

| Tier | What it covers | Model | Effort |
|---|---|---|---|
| 1 | Styles, copy, component tweaks | `claude-sonnet-5` | low / medium / high |
| 2 | New logic (handlers, state, forms, data) | `claude-opus-4-8` | medium / high / xhigh |
| 3 | Multi-feature or cross-cutting work | `claude-opus-4-8` | xhigh |
| 3+ | Auth, payments, data, security | `claude-fable-5` | high |

Routing is layered: a deterministic lexicon and structure score runs first (<1ms, free), and only requests with no clear signal fall through to a Haiku classifier with structured output (~1–3s, ~$0.001). Most requests never reach it.

**You can audit any decision without spending a token on the edit:**
```sh
curl -s localhost:4100/api/classify -d '{"instruction":"add a loading state"}'
```

Override any tier with an env var (`CMDZERO_T1_MODEL` … `CMDZERO_T3_CRITICAL_MODEL`), or pin the whole strategy with `CMDZERO_ROUTER=heuristic|hybrid|llm`.

---

## Trust section

### It's just your code

- **Every change is a normal git diff.** Review it, revert it, commit it. No proprietary sync layer.
- **Undo per tweak,** right from the tray — or `⌘Z` for the last one, anywhere on the page.
- **Changes show up without a refresh.** After a write settles, the overlay reloads the page and puts your scroll position and selection back, so HMR gaps (module-scope consts, structural edits) never strand you on a stale screen. Toggle it off bottom-left.
- **Dev-only by construction.** The stamp lives in React's development runtime; production builds import a passthrough.
- **Scoped AI, when AI runs at all.** The model sees one file and your instruction — not your repo. And the routing decision is inspectable before you run it.
- **A running savings counter** in the banner shows tweaks, dollars saved, time saved, and how many cost zero tokens — measured against an unscoped agent session. That's your invoice not happening. *(Want the receipts? Get a monthly savings report — email capture, see below.)*
- **Telemetry that announces itself.** Anonymous usage counts only — version, OS, tweak counts. Never code, paths, or prompts. Disclosed on first run, disabled with one env var (`CMDZERO_TELEMETRY=0`), and `DO_NOT_TRACK` is respected.

---

## Ship it section

### From "hmm, a bit less" to production, without leaving the page

Polish the page, then hit **Build & Deploy** in the banner. CmdZero commits the session's tweaks, pushes, and deploys — and drops the production URL in the tray when it lands. The whole loop, from noticing the padding to shipping the fix, never leaves the browser tab you noticed it in.

*(Vercel projects today. Everything it does is a command you could have typed yourself, in your repo, on your remote.)*

---

## FAQ

**Does this replace my coding agent?**
No — it feeds it. Claude Code does the heavy lifting for functionality changes; CmdZero gives it surgical context instead of a treasure hunt. And for the majority of UI tweaks, no agent is needed at all.

**What do I need for the AI lane?**
The Claude Code CLI on your PATH. Copy, style, and structure lanes work without it.

**Does it work with my design system?**
Yes. CmdZero reads color tokens from the running page — any CSS custom property whose value is a color, whatever produced it — plus Tailwind v4 theme variables. Your swatches are your palette.

**What about CSS Modules / styled-components / plain CSS?**
You still get a zero-token style lane. CmdZero detects whether the project uses Tailwind: if it does, edits are deterministic class changes; if it doesn't, they're deterministic inline-style edits on a px scale. Neither calls a model. Deeper attribution for CSS-in-JS source files is on the roadmap.

**Next.js only?**
Next.js and Vite today — anything that emits React's standard dev JSX runtime, including Turbopack and webpack. Remix/React Router support is planned.

**What does telemetry collect?**
Version, OS, and how many tweaks ran per lane — that's the whole payload. No code, no file paths, no prompts, no identity. It's disclosed the first time the daemon runs, `CMDZERO_TELEMETRY=0` turns it off forever, and we respect `DO_NOT_TRACK=1`. It exists so we know which frameworks to support next.

---

## Pricing

*(Strategy: free during beta to drive adoption; the paid tiers monetize the workflow, not the inference — users bring their own Claude. Publish tiers at launch, gate nothing during beta except team features.)*

### Free — forever, for solo dev loops
Local overlay, all four lanes, model routing and its overrides, bring your own Claude. The core stays free because your padding tweak should never have cost money in the first place.

### Pro — $15/dev/month
Savings analytics and monthly reports, design-system panel customization, deploy history, priority support. *For developers who polish UI every day and want the numbers to prove it.*

### Team — $40/seat/month
Preview-deploy tweaking: designers and PMs point at staging, their tweaks arrive as PRs your engineers approve. Audit trail, SSO. *UI polish stops being a ticket queue.*

**Beta note:** everything is free while we're in beta. Early users get grandfathered Pro pricing.

---

## Email capture (waitlist + savings report)

*(One field, two placements. This list is the launch asset — every address here is a developer who already cares.)*

**Placement 1 — below the hero install command:**
> **Get the changelog + Pro early access.** One email when something ships. No drip sequence, no "just checking in."
> `[you@company.dev] [Keep me posted]`

**Placement 2 — the savings report (linked from the in-app tray):**
> ### Your polish pass, itemized
> CmdZero already counts what every tweak would have cost through an unscoped agent. Get the monthly rollup: tweaks shipped, tokens avoided, dollars saved. One email a month, made of your own numbers.
> `[you@company.dev] [Send my savings report]`

*(Annotation: placement 2 converts because the user arrives from the tray already looking at their number — the email is a continuation of value, not an interruption. Both feed one list, tagged by source.)*

---

## Final CTA

### Your next padding tweak takes four milliseconds

```sh
npm i -D cmdzero @cmdzero/react
```

Press `⌘0` and click anything. Or [try it without installing anything](https://cmdzero.xyz/demo).

---

## Annotations

- **Headline** attacks the real pain (describing UI in prose) rather than claiming a category ("visual editor") that devs distrust. "Point at it" is the product's whole interaction model in three words.
- **Zero-token claim leads everywhere** because it's the falsifiable differentiator — competitors are "AI editors"; CmdZero's story is *less* AI, used precisely. Three of the four lanes never call a model.
- **Install command as CTA**, with the live demo promoted to a real secondary. For warm traffic `npm i` is the first step of activation; for cold traffic the demo is the only asset that proves the interaction model before asking for anything.
- **The 40-second story** mirrors voice-of-customer (agent round-trip frustration) and sets up the benchmark numbers as the punchline.
- **Model routing got its own section** because "which model, and can I see why" is the #2 objection after safety. A table of real model names and a curl command that lets you audit a decision for free is worth more than any adjective.
- **Trust section** exists because the audience's #1 objection to anything that writes code is safety; every bullet names a mechanism, not a promise.
- **Ship-it section** closes the loop the problem section opens: the pain was a round trip, so the payoff has to be "and then it's live." Kept honest and short — it's a wrapper around git and `vercel --prod`, and saying so is more persuasive than implying magic.
- **Pricing rationale** shown to the team here (italic notes) — strip the notes for the public page.

### Headline alternatives
- A: **Stop describing your UI to an AI. Point at it.** — pain-first, names the enemy behavior.
- B: **Your padding tweak doesn't need 137,000 tokens.** — benchmark-specific, wry; great for the ad/tweet variant.
- C: **Click the element. Ship the diff.** — mechanism-first, tighter, weaker on pain. Stronger now that Build & Deploy actually ships the diff.

### CTA alternatives
- A: `npm i -D cmdzero @cmdzero/react` (copy button) — activation-first.
- B: **Try the live demo — no install** — for cold traffic that needs proof before install.
- C: **Tweak your first element** — docs-quickstart framing.

### Meta
- **Title:** CmdZero — point at your UI, ship the diff
- **Description:** Tweak your running app in the browser and write the changes straight to source. Copy, style, and structure edits cost zero tokens; everything else routes to a right-sized model. Next.js and Vite.
