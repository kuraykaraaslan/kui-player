# kui-player — Brand

The mark is generated, not drawn. [`geometry.mjs`](geometry.mjs) is the single
source of truth; [`build.mjs`](build.mjs) writes every asset from it:

```
node brand/build.mjs
```

Never hand-edit a committed SVG — the next run overwrites it, and a favicon
that silently keeps the old shape is the failure mode this arrangement exists
to prevent.

## Construction

A "K" whose stem forks into two arms at **exactly 45 degrees**. The
construction is shared by every `@kuraykaraaslan/kui-*` package and is fixed by
`Brand_Positioning_Rules/logo-system.md`: 64-unit grid, stroke 7 (~10.9% of the
grid), round caps, rounded-square tile at radius 14 (~22%).

Nothing in that list may differ between packages. A viewer who has seen two of
the marks should recognise the third by its shape.

## Palette

| Role | Value | Why |
|---|---|---|
| first tone | `#3b82f6` | the family's `--primary` at blue-500. The UI ships blue-600 because white on blue-500 is 3.68:1; a mark is a graphic, not a button label, so it keeps the brighter step |
| second tone | `#22c55e` | **played progress** — played progress — the part of the timeline already watched |
| tile | `#0f172a` | the family's dark ground |

The first tone is shared with every sibling; the second is this package's own
and has to mean something. A second colour picked because it looked good is
the one thing this file forbids.

## Assets

| File | Purpose |
|---|---|
| [`mark.svg`](mark.svg) | app icon / avatar |
| [`wordmark.svg`](wordmark.svg) | lockup for light surfaces |
| [`wordmark-inverse.svg`](wordmark-inverse.svg) | lockup for dark surfaces |
| [`og-card.svg`](og-card.svg) | 1200×630 social card |
| `../public/favicon.svg` | the icon the demo serves |

Lockup rules: clear space on all sides equals half the mark's height; the mark
never appears under 16px with the wordmark attached — use the mark alone.
