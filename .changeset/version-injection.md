---
"@kuraykaraaslan/kui-player": patch
---

The About dialog now shows the version that was actually built, injected from
`package.json` at build time instead of a hard-coded literal that would go stale
on the next release.
