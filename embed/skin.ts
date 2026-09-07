/**
 * Skin mode for bundler users. The single-script build (`dist/embed.js`)
 * installs `window.kuiPlayer` and auto-starts; this entry point exports the same
 * capability as plain functions, with React kept external.
 */
export { mountSkin, SKINNED_ATTR } from './mountSkin.js';
export type { SkinOptions } from './mountSkin.js';
export { skinAll } from './skinAll.js';
export type { SkinAllOptions, SkinAllHandle } from './skinAll.js';
