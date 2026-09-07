# Contributing to kui-player

Thanks for taking the time. This is a small library with a deliberately small
dependency surface, so the bar for adding code — and especially for adding
dependencies — is high. That is the main thing to know before opening a PR.

## Getting set up

```bash
pnpm install
pnpm dev            # the playground at http://localhost:5173
```

| Command | What it does |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` against the library config |
| `pnpm lint` | ESLint over everything (`lint:fix` to autofix) |
| `pnpm test` | unit + component tests (Vitest, jsdom) |
| `pnpm test:watch` | the same, in watch mode |
| `pnpm test:coverage` | with coverage; `modules/` must stay above 80% |
| `pnpm test:e2e` | Playwright, against the harness in `tests/e2e/app` |
| `pnpm build` | JS + `.d.ts` + `styles.css` + the embed bundle |
| `pnpm size` | enforce the gzip budgets in `package.json` |
| `pnpm check:package` | `publint` + `arethetypeswrong` on the packed tarball |

Browsers for the end-to-end run install separately:

```bash
npx playwright install chromium firefox webkit
```

## The rules that actually matter

**No new runtime dependencies.** `zustand` is the only one, and it is on its way
out. If something needs a library, it is either a `devDependency`, an optional
adapter the consumer wires up themselves (see `createHlsAdapter`), or it does
not happen.

**The bundle has a budget.** `pnpm size` fails the build when a bundle grows past
its limit. If a feature does not fit, put it behind a lazy chunk — that is how
Cast, the settings panel, the About dialog and the touch gestures are shipped.

**The `<video>` element is the source of truth.** The store mirrors it; it never
leads. Any new state should arrive from an element event.

**`modules/` stays framework-agnostic.** No React imports below `react/`. If a
feature needs both, the logic goes in the engine and the wiring in a hook.

**Accessibility is a requirement, not a follow-up.** New controls need a name, a
keyboard path, a visible focus ring, and a line in the live region if their
state is worth announcing. `pnpm test` includes an axe-core scan.

**Styles live in `react/styles/player.css`.** Everything is scoped under
`.kui-player` and prefixed `kui-`. New colours and sizes go through the
`--kui-*` custom properties rather than being hard-coded.

## Making a change

1. Branch off `main`.
2. Write the test first where you sensibly can — engine behaviour in
   `tests/unit`, anything user-visible in `tests/component`, browser-only
   behaviour (gestures, fullscreen, real media) in `tests/e2e`.
3. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm size`.
4. Add a changeset: `pnpm changeset`. Describe the change the way a consumer
   would read it in a changelog.
5. Open the PR. CI runs the same checks plus the end-to-end matrix.

## Reporting a bug

Media bugs are browser-specific almost by definition, so please include the
browser and version, the source type (progressive MP4, HLS, DASH), whether an
adapter is in play, and — if you can — a reduced case in the playground.

## Roadmap

`phases/` holds the plan and its rationale: what is built, what is next, and why
the order is what it is. Phases 0–3 are the release gate for `0.1.0`.
