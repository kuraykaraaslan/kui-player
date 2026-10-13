import { describe, expect, it } from 'vitest';
import {
  base64url, fromBase64url, signCloudFrontCookies, signCloudflareStreamToken, signLicenseToken, verifyLicenseToken,
} from '../../examples/token-server/token';
import { createTokenHandler } from '../../examples/token-server/worker';

const dec = new TextDecoder();
const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);

async function rsaPair(hash: 'SHA-256' | 'SHA-1') {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash }, true, ['sign', 'verify'],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  return { publicKey: pair.publicKey, pem };
}

describe('base64url', () => {
  it('round-trips and is URL-safe', () => {
    const bytes = Uint8Array.from([251, 255, 254, 0, 1]);
    const text = base64url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64url(text))).toEqual(Array.from(bytes));
  });
});

describe('license tokens', () => {
  const secret = 'test-secret';

  it('verifies a fresh token for the right content', async () => {
    const token = await signLicenseToken({ secret, userId: 'u1', contentId: 'movie-1', now: NOW });
    const verdict = await verifyLicenseToken({ secret, token, contentId: 'movie-1', now: NOW + 1000 });
    expect(verdict).toMatchObject({ ok: true, claims: { sub: 'u1', cid: 'movie-1' } });
  });

  it('rejects expired, other-content, wrong-secret, tampered and malformed tokens', async () => {
    const token = await signLicenseToken({ secret, userId: 'u1', contentId: 'movie-1', ttlSeconds: 60, now: NOW });
    expect(await verifyLicenseToken({ secret, token, contentId: 'movie-1', now: NOW + 61_000 })).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyLicenseToken({ secret, token, contentId: 'movie-2', now: NOW })).toEqual({ ok: false, reason: 'wrong-content' });
    expect(await verifyLicenseToken({ secret: 'other', token, contentId: 'movie-1', now: NOW })).toEqual({ ok: false, reason: 'bad-signature' });

    const [h, p, s] = token.split('.') as [string, string, string];
    const forged = base64url(new TextEncoder().encode(JSON.stringify({ ...JSON.parse(dec.decode(fromBase64url(p))), cid: 'movie-2' })));
    expect(await verifyLicenseToken({ secret, token: `${h}.${forged}.${s}`, contentId: 'movie-2', now: NOW })).toEqual({ ok: false, reason: 'bad-signature' });
    expect(await verifyLicenseToken({ secret, token: 'nope', contentId: 'movie-1', now: NOW })).toEqual({ ok: false, reason: 'malformed' });
  });

  it('never accepts a token that picks its own algorithm', async () => {
    const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'none', typ: 'JWT' })));
    const payload = base64url(new TextEncoder().encode(JSON.stringify({ sub: 'u1', cid: 'movie-1', iat: 0, exp: 9_999_999_999 })));
    expect(await verifyLicenseToken({ secret, token: `${header}.${payload}.`, contentId: 'movie-1', now: NOW }))
      .toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('Cloudflare Stream token', () => {
  it('is an RS256 JWT carrying kid, sub, nbf and exp that verifies with the public key', async () => {
    const { publicKey, pem } = await rsaPair('SHA-256');
    const token = await signCloudflareStreamToken({ keyId: 'key-1', privateKeyPem: pem, videoId: 'vid-9', ttlSeconds: 600, now: NOW });
    const [h, p, s] = token.split('.') as [string, string, string];
    expect(JSON.parse(dec.decode(fromBase64url(h)))).toEqual({ alg: 'RS256', kid: 'key-1' });
    const claims = JSON.parse(dec.decode(fromBase64url(p))) as Record<string, unknown>;
    expect(claims).toMatchObject({ sub: 'vid-9', kid: 'key-1', exp: NOW / 1000 + 600 });
    expect(claims.nbf as number).toBeLessThan(NOW / 1000);
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, fromBase64url(s), new TextEncoder().encode(`${h}.${p}`))).toBe(true);
  });
});

describe('CloudFront signed cookies', () => {
  const unCloudFront = (text: string) =>
    Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/')), (c) => c.charCodeAt(0));

  it('encodes a custom policy and signs it with RSA-SHA1', async () => {
    const { publicKey, pem } = await rsaPair('SHA-1');
    const cookies = await signCloudFrontCookies({
      keyPairId: 'K123', privateKeyPem: pem, resource: 'https://cdn.example.com/movie/*', ttlSeconds: 900, now: NOW,
    });
    expect(cookies['CloudFront-Key-Pair-Id']).toBe('K123');
    expect(cookies['CloudFront-Policy']).not.toMatch(/[+=/]/);
    expect(cookies['CloudFront-Signature']).not.toMatch(/[+=/]/);

    const policyBytes = unCloudFront(cookies['CloudFront-Policy']);
    const policy = JSON.parse(dec.decode(policyBytes)) as {
      Statement: { Resource: string; Condition: { DateLessThan: { 'AWS:EpochTime': number } } }[];
    };
    expect(policy.Statement[0]!.Resource).toBe('https://cdn.example.com/movie/*');
    expect(policy.Statement[0]!.Condition.DateLessThan['AWS:EpochTime']).toBe(NOW / 1000 + 900);
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, unCloudFront(cookies['CloudFront-Signature']), policyBytes)).toBe(true);
  });
});

describe('token handler', () => {
  const secret = 'test-secret';
  const call = (path: string, authorize: (r: Request, c: string) => string | null, method = 'GET') =>
    createTokenHandler({ authorize, licenseSecret: secret })(new Request(`https://t.example${path}`, { method }));

  it('issues a license token only to someone authorize() accepts', async () => {
    const ok = await call('/license-token?contentId=m1', () => 'user-7');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const { token } = await ok.json() as { token: string };
    expect(await verifyLicenseToken({ secret, token, contentId: 'm1' })).toMatchObject({ ok: true, claims: { sub: 'user-7' } });

    expect((await call('/license-token?contentId=m1', () => null)).status).toBe(403);
  });

  it('validates the request', async () => {
    expect((await call('/license-token', () => 'u')).status).toBe(400);
    expect((await call('/license-token?contentId=m1', () => 'u', 'POST')).status).toBe(405);
    expect((await call('/other?contentId=m1', () => 'u')).status).toBe(404);
    expect((await call('/stream-token?contentId=m1', () => 'u')).status).toBe(501);   // not configured
  });
});
