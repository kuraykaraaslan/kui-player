# Token server (example)

Mints the short-lived tokens the streaming setups in `docs/phases/07-drm-streaming.md` need:

| Endpoint | Returns | Used by |
|---|---|---|
| `GET /license-token?contentId=…` | HS256 JWT bound to viewer + content, 5 min | the `drm.*.headers` callback → your license server / proxy |
| `GET /stream-token?contentId=…` | RS256 JWT for a Cloudflare Stream video that requires signed URLs | the playback URL |
| `signCloudFrontCookies()` (library function) | CloudFront signed-cookie triple | set on your domain for the CDN |

```ts
import { createTokenHandler } from "./worker";

export default {
  fetch: createTokenHandler({
    // YOUR rule: is this signed-in viewer entitled to this video? Return their id, or null.
    authorize: async (request, contentId) => myApp.userWhoMayWatch(request, contentId),
    licenseSecret: env.LICENSE_SECRET,
  }),
};
```

```ts
// player side
drm: { widevine: { licenseUrl, headers: async () => ({
  Authorization: `Bearer ${(await (await fetch(`/license-token?contentId=${id}`)).json()).token}`,
}) } }
```

## What is and is not verified

- **Verified (unit tests, Node):** token structure; signatures verify with the matching public key; the
  HS256 verifier rejects tampered, expired, wrong-content and `alg`-swapped tokens; CloudFront policy
  encoding round-trips and its RSA-SHA1 signature verifies; the handler denies by default.
- **Not verified:** that Cloudflare, CloudFront or a DRM license server **accepts** these. The Cloudflare
  token layout and the CloudFront cookie format are written from their documentation as remembered;
  Cloudflare's docs could not be fetched while this was written. Confirm each against the service's
  current docs and a real account before production.
- Keys: never commit them; keep the Cloudflare PEM and CloudFront private key in your platform's secret store.
- This is **not** a license server. Widevine/PlayReady licenses come from your DRM provider.
