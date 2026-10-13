# DRM (Widevine and PlayReady)

Protected playback uses hls.js's Encrypted Media Extensions support. One packaging output
covers both systems: **CMAF (fMP4) + `cbcs` encryption + an HLS manifest**.

```ts
import Hls from "hls.js";
import { createHlsAdapter } from "@kuraykaraaslan/kui-player";

const adapter = createHlsAdapter({
  Hls,
  drm: {
    widevine: {
      licenseUrl: "https://license.example.com/widevine",
      // Called for every license request, so the token can be fresh each time.
      headers: async () => ({ Authorization: `Bearer ${await getLicenseToken()}` }),
    },
    playready: {
      licenseUrl: "https://license.example.com/playready",
      headers: async () => ({ Authorization: `Bearer ${await getLicenseToken()}` }),
    },
  },
});

<VideoPlayer src="https://cdn.example.com/movie/master.m3u8" adapters={[adapter]} />
```

- **Which license server?** None is bundled and none is written here. Your DRM provider (EZDRM,
  BuyDRM, Axinom, PallyCon …) issues licenses; a packager such as AWS MediaConvert (SPEKE) only
  encrypts. Put access control in the `headers` callback — a short-lived token your backend
  mints after checking the viewer may watch.
- **Cost when unused:** the DRM code is a separate chunk (about 1.3 kB gzip) that is fetched only
  when `drm` is set.
- **HTTPS only** (or `localhost`): browsers disable EME on plain HTTP.

## What the viewer sees

Each failure has its own error code and a localised message (6 languages):

| `error.name` | Meaning | Retry button |
|---|---|---|
| `DRM_UNSUPPORTED` | no EME / no matching key system / no Media Source Extensions | no |
| `DRM_LICENSE_DENIED` | the license server answered 401 / 403 — no access, or the token expired | no |
| `DRM_LICENSE_NETWORK` | the license request failed any other way | yes |
| `DRM_OUTPUT_RESTRICTED` | HDCP / output protection refuses the connected display | no |

The browser is probed with `requestMediaKeySystemAccess` **before** the stream loads, so an
unsupported browser fails immediately instead of buffering forever.

## Safari and iOS

FairPlay is out of scope. When `drm` is set the native HLS path (`video.src = …`) is never used —
it would stall silently on encrypted segments — and Safari/iOS get `DRM_UNSUPPORTED` with a clear
message. (If you do need Safari later, the same `cbcs` output works with FairPlay.)

## Honest limits

- DRM makes copying **harder, not impossible**: a low-security-level (L3) device can still be screen-recorded.
  A visible `watermark` (see the README) is the complementary deterrent.
- Cast: the receiver must support the same DRM; this player does not set that up for you.
- Tested against mocks (key-system mapping, header callback on every request, error mapping, the
  Safari refusal). **Real playback needs a real license server and a CDM**; headless Chromium has no
  CDM, so end-to-end playback is checked by hand in Chrome (Widevine) and Edge (PlayReady).
