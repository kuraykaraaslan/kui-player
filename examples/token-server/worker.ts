/**
 * A small token endpoint, written for Cloudflare Workers (and testable in Node:
 * it is just `Request` → `Response`). It only mints tokens — it never checks who
 * the viewer is by itself. YOU supply `authorize`, because "may this person
 * watch this?" is your product's rule, not something an example can guess.
 */
import { signCloudflareStreamToken, signLicenseToken } from './token.js';

export type TokenServerOptions = {
  /**
   * Return the viewer's id if they may watch `contentId`, else `null`.
   * There is deliberately no default: an example that allows everyone by
   * default gets deployed that way.
   */
  authorize: (request: Request, contentId: string) => Promise<string | null> | string | null;
  licenseSecret: string;
  /** Optional: also mint Cloudflare Stream tokens. */
  cloudflare?: { keyId: string; privateKeyPem: string };
  ttlSeconds?: number;
};

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export function createTokenHandler(options: TokenServerOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const contentId = url.searchParams.get('contentId');
    if (request.method !== 'GET') return reply(405, { error: 'method not allowed' });
    if (!contentId) return reply(400, { error: 'contentId is required' });
    if (url.pathname !== '/license-token' && url.pathname !== '/stream-token') return reply(404, { error: 'not found' });

    const userId = await options.authorize(request, contentId);
    if (!userId) return reply(403, { error: 'not allowed to watch this' });

    if (url.pathname === '/license-token') {
      const token = await signLicenseToken({
        secret: options.licenseSecret, userId, contentId, ttlSeconds: options.ttlSeconds,
      });
      return reply(200, { token });
    }
    if (!options.cloudflare) return reply(501, { error: 'cloudflare signing is not configured' });
    const token = await signCloudflareStreamToken({ ...options.cloudflare, videoId: contentId, ttlSeconds: options.ttlSeconds });
    return reply(200, { token });
  };
}
