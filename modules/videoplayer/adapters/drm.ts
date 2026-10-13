import type { PlayerError } from '../videoplayer.types.js';

/**
 * Widevine / PlayReady playback through hls.js's EME support. Loaded on demand
 * by the HLS adapter, only when a `drm` option is given — a player that never
 * plays protected content carries none of this.
 *
 * Safari and iOS (FairPlay) are not supported by design; they get a clear error
 * rather than a silent stall.
 */
export type DrmKeySystem = 'widevine' | 'playready';

export type DrmLicenseContext = { keySystem: DrmKeySystem; url: string };

export type DrmSystemOptions = {
  licenseUrl: string;
  /**
   * Request headers for each license request — typically a short-lived token.
   * Called for *every* request, so the token can be refreshed.
   */
  headers?: (context: DrmLicenseContext) => Record<string, string> | Promise<Record<string, string>>;
};

export type DrmOptions = Partial<Record<DrmKeySystem, DrmSystemOptions>>;

export const KEY_SYSTEM_IDS: Record<DrmKeySystem, string> = {
  widevine: 'com.widevine.alpha',
  playready: 'com.microsoft.playready',
};

const SYSTEMS = Object.keys(KEY_SYSTEM_IDS) as DrmKeySystem[];

/** The configured systems, in a stable order. */
export function configuredSystems(drm: DrmOptions): DrmKeySystem[] {
  return SYSTEMS.filter((s) => Boolean(drm[s]?.licenseUrl));
}

/**
 * The hls.js settings that switch EME on. `licenseXhrSetup` runs per license
 * request: it opens the request itself (hls.js would open it afterwards, and
 * headers can only be set on an open request) and adds the caller's headers.
 */
export function buildDrmConfig(drm: DrmOptions): Record<string, unknown> {
  const drmSystems: Record<string, { licenseUrl: string }> = {};
  for (const system of configuredSystems(drm)) {
    drmSystems[KEY_SYSTEM_IDS[system]] = { licenseUrl: drm[system]!.licenseUrl };
  }
  return {
    emeEnabled: true,
    drmSystems,
    licenseXhrSetup: async (xhr: XMLHttpRequest, url: string) => {
      const system = configuredSystems(drm).find((s) => drm[s]!.licenseUrl === url);
      const headers = system ? await drm[system]!.headers?.({ keySystem: system, url }) : undefined;
      if (xhr.readyState === 0) xhr.open('POST', url, true);
      for (const [name, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(name, value);
    },
  };
}

const PROBE_CONFIG: MediaKeySystemConfiguration[] = [{
  initDataTypes: ['cenc'],
  videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
}];

/**
 * Whether this browser can run at least one of the configured key systems.
 * Fails closed with a clear message instead of letting playback stall.
 */
export async function probeKeySystems(drm: DrmOptions): Promise<PlayerError | null> {
  const systems = configuredSystems(drm);
  if (systems.length === 0) {
    return drmError('DRM_UNSUPPORTED', 'DRM was requested but no license URL is configured.', false);
  }
  const request = typeof navigator === 'undefined' ? undefined : navigator.requestMediaKeySystemAccess?.bind(navigator);
  if (!request) {
    return drmError('DRM_UNSUPPORTED', 'This browser cannot play protected video (no Encrypted Media Extensions).', false);
  }
  for (const system of systems) {
    try {
      await request(KEY_SYSTEM_IDS[system], PROBE_CONFIG);
      return null;
    } catch { /* try the next system */ }
  }
  return drmError('DRM_UNSUPPORTED', 'This browser does not support the content protection this video needs.', false);
}

export function drmError(name: string, message: string, recoverable: boolean): PlayerError {
  const codes: Record<string, number> = {
    DRM_UNSUPPORTED: 100, DRM_LICENSE_DENIED: 101, DRM_LICENSE_NETWORK: 102, DRM_OUTPUT_RESTRICTED: 103,
  };
  return { code: codes[name] ?? 100, name, message, recoverable };
}

type HlsErrorData = {
  details?: string;
  fatal?: boolean;
  response?: { code?: number };
  error?: { message?: string };
};

const UNSUPPORTED = new Set([
  'keySystemNoAccess', 'keySystemNoKeys', 'keySystemNoSession', 'keySystemNoConfiguredLicense',
  'keySystemServerCertificateRequestFailed',
]);

/**
 * Turn an hls.js key-system error into a specific `PlayerError`, or `null` for
 * errors that are not about DRM. Denied (401/403) and a flaky network are told
 * apart because only one of them is worth a retry.
 */
export function mapDrmError(data: HlsErrorData | undefined): PlayerError | null {
  const details = data?.details;
  if (!details || !details.startsWith('keySystem')) return null;
  if (UNSUPPORTED.has(details)) {
    return drmError('DRM_UNSUPPORTED', 'This browser could not set up content protection for this video.', false);
  }
  if (details === 'keySystemStatusOutputRestricted') {
    return drmError('DRM_OUTPUT_RESTRICTED', 'This video cannot play on this display (output protection).', false);
  }
  if (details === 'keySystemLicenseRequestFailed') {
    const status = data?.response?.code;
    if (status === 401 || status === 403) {
      return drmError('DRM_LICENSE_DENIED', 'The license server refused this request — you may not have access.', false);
    }
    return drmError('DRM_LICENSE_NETWORK', 'The license could not be fetched — check your connection.', true);
  }
  return drmError('DRM_UNSUPPORTED', 'Content protection failed for this video.', false);
}
