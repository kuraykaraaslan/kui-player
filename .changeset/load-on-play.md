---
"@kuraykaraaslan/kui-player": minor
---

`loadOnPlay` (React prop and engine option, default `false`): an HLS source is not attached and no playlist or segment is requested until the first play intent (the Play button, `engine.play()`); `autoPlay` loads at once. Sources no adapter claims are unaffected. A player that never started is not counted by the presence check and makes no requests while hidden. The engine gains `load()` and `setLoadOnPlay()`.
