# Cloudflare Stream or AWS? (draft — read the caveats)

**Status: a decision frame, not a measured comparison.** Phase 7 planned to *run* both pipelines and
compare setup time, cost and DRM coverage. That needs real Cloudflare and AWS accounts and has not been
done. Everything below is what the player's side already guarantees, plus questions to answer yourself.

## What the player needs from either

- An **HLS manifest** reachable with CORS (and `Range`) allowed, played through `createHlsAdapter({ Hls })`.
- For access control: a way to hand the viewer a **short-lived credential** — a signed URL/token or signed
  cookies — and for DRM, a **license** request that carries a token (`drm.*.headers`, see [drm.md](./drm.md)).
- `examples/token-server` mints those tokens (Cloudflare Stream token, CloudFront cookies, a license JWT).
  Its signatures are unit-tested; acceptance by the real services is **not**.

## Questions that decide it

| Question | Lean Cloudflare Stream | Lean AWS (MediaConvert + CloudFront) |
|---|---|---|
| Do you want to run an encoder pipeline? | No — upload and play | Yes — you choose codecs, ladder, packaging |
| Need DRM (Widevine/PlayReady)? | **Unverified.** Cloudflare's docs could not be fetched when this was written; check whether Stream offers DRM at all before choosing it for protected content | Yes, via MediaConvert encryption (SPEKE) plus a DRM provider's license server |
| Access control | Signed URL tokens | CloudFront signed URLs or cookies, plus OAC to keep the bucket private |
| Control over cost and ladder | Less | More, with more to get wrong |
| Live | Check Stream's live offering | MediaConvert is file-based; live needs MediaLive |

## Not answered here

- Real setup time, real cost for your volume, and measured startup/rebuffer differences. The player now
  emits `ready`, `stall` and `qoe` events ([analytics.md](./analytics.md)) so you can measure both on the
  same video — that is the intended way to settle it.
- **Cast with DRM:** the receiver must support the same DRM; not checked here.
- Whether Cloudflare Stream's built-in DRM exists — the first thing phase 7.1 asked to verify.
