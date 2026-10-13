/**
 * Token signing for the kui-player streaming setups (docs/phases/07).
 * Web Crypto only — runs unchanged in Node 20+, Cloudflare Workers and browsers,
 * with no dependency. NOT part of the library bundle.
 *
 * Verified here: the shape of what is signed and that the signatures verify
 * with the matching public key (tests/unit/token-server.test.ts). NOT verified:
 * acceptance by the real Cloudflare / CloudFront / license servers — check each
 * against that service's current documentation before relying on it.
 */
const encoder = new TextEncoder();

export const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromBase64url = (text: string): Uint8Array<ArrayBuffer> => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const json = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));

/** PEM (`-----BEGIN PRIVATE KEY-----`, PKCS#8) → DER bytes. */
function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

// ── license tokens (HS256) ───────────────────────────────────────────────────

export type LicenseClaims = { sub: string; cid: string; exp: number; iat: number };

const hmacKey = (secret: string, usage: KeyUsage) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

/**
 * A short-lived token the license server (or your proxy in front of it) checks
 * before issuing a license. Bound to one viewer and one piece of content.
 */
export async function signLicenseToken(options: {
  secret: string; userId: string; contentId: string; ttlSeconds?: number; now?: number;
}): Promise<string> {
  const iat = Math.floor((options.now ?? Date.now()) / 1000);
  const claims: LicenseClaims = { sub: options.userId, cid: options.contentId, iat, exp: iat + (options.ttlSeconds ?? 300) };
  const unsigned = `${json({ alg: 'HS256', typ: 'JWT' })}.${json(claims)}`;
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(options.secret, 'sign'), encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(mac))}`;
}

export type TokenVerdict =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-content' };

export async function verifyLicenseToken(options: {
  secret: string; token: string; contentId: string; now?: number;
}): Promise<TokenVerdict> {
  const parts = options.token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, payload, signature] = parts as [string, string, string];
  let claims: LicenseClaims;
  try {
    const head = JSON.parse(new TextDecoder().decode(fromBase64url(header))) as { alg?: string };
    if (head.alg !== 'HS256') return { ok: false, reason: 'malformed' };   // never trust the token's own algorithm choice
    claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as LicenseClaims;
  } catch { return { ok: false, reason: 'malformed' }; }

  const valid = await crypto.subtle.verify(
    'HMAC', await hmacKey(options.secret, 'verify'), fromBase64url(signature), encoder.encode(`${header}.${payload}`),
  );
  if (!valid) return { ok: false, reason: 'bad-signature' };
  if ((options.now ?? Date.now()) / 1000 >= claims.exp) return { ok: false, reason: 'expired' };
  if (claims.cid !== options.contentId) return { ok: false, reason: 'wrong-content' };
  return { ok: true, claims };
}

// ── Cloudflare Stream signed token (RS256) ───────────────────────────────────

/**
 * The self-signed token form Cloudflare Stream documents for videos that
 * require signed URLs: an RS256 JWT with `kid`, `sub` (the video id), `exp`
 * and `nbf`. The key id / PEM come from a Stream signing key you create.
 */
export async function signCloudflareStreamToken(options: {
  keyId: string; privateKeyPem: string; videoId: string; ttlSeconds?: number; now?: number;
}): Promise<string> {
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const unsigned = `${json({ alg: 'RS256', kid: options.keyId })}.${json({
    sub: options.videoId, kid: options.keyId, nbf: now - 30, exp: now + (options.ttlSeconds ?? 3600),
  })}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(options.privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

// ── CloudFront signed cookies (custom policy) ────────────────────────────────

/** CloudFront's base64 variant: `+` → `-`, `=` → `_`, `/` → `~`. */
const cloudFrontBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/=/g, '_').replace(/\//g, '~');

export type CloudFrontCookies = {
  'CloudFront-Policy': string;
  'CloudFront-Signature': string;
  'CloudFront-Key-Pair-Id': string;
};

/**
 * Cookies that let one viewer fetch everything under `resource` (e.g.
 * `https://cdn.example.com/movie/*`) until `expiresAt`. HLS needs a wildcard
 * resource: playlist and segments are separate URLs. Set them with
 * `Secure; HttpOnly; Domain=…` on your own domain, which must share a parent
 * domain with the distribution.
 */
export async function signCloudFrontCookies(options: {
  keyPairId: string; privateKeyPem: string; resource: string; ttlSeconds?: number; now?: number;
}): Promise<CloudFrontCookies> {
  const expires = Math.floor((options.now ?? Date.now()) / 1000) + (options.ttlSeconds ?? 3600);
  const policy = JSON.stringify({
    Statement: [{ Resource: options.resource, Condition: { DateLessThan: { 'AWS:EpochTime': expires } } }],
  });
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(options.privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(policy));
  return {
    'CloudFront-Policy': cloudFrontBase64(encoder.encode(policy)),
    'CloudFront-Signature': cloudFrontBase64(new Uint8Array(signature)),
    'CloudFront-Key-Pair-Id': options.keyPairId,
  };
}
