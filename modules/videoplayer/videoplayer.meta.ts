// Replaced at build time with the version from package.json (see the `define`
// in every vite config), so the About dialog cannot drift from what shipped.
declare const __KUI_VERSION__: string;

/** Static credits shown in the player's in-app "About" dialog. */
export const PLAYER_META = {
  name: 'kui-player',
  tagline: 'Standalone video player',
  version: typeof __KUI_VERSION__ === 'string' ? __KUI_VERSION__ : '0.0.0-dev',
  author: 'Kuray Karaaslan',
  website: 'https://kuray.dev',
  websiteLabel: 'kuray.dev',
  linkedin: 'https://www.linkedin.com/in/kuraykaraaslan',
  linkedinLabel: 'linkedin.com/in/kuraykaraaslan',
  npm: '@kuraykaraaslan/kui-player',
  npmUrl: 'https://www.npmjs.com/package/@kuraykaraaslan/kui-player',
} as const;
