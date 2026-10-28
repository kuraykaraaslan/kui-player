/**
 * Skin mode for bundler users. The single-script build (`dist/embed.js`)
 * installs `window.kuiPlayer` and auto-starts; this entry point exports the same
 * capability as plain functions, with React kept external.
 */
export { mountSkin, SKINNED_ATTR } from './mountSkin.js';
export type { SkinOptions, SkinHandle, SkinLiveUpdate, SkinEventHandlers } from './mountSkin.js';
export {
  createPagePresenceGroup, mountPresencePrompt, setPagePresence, getPagePresence,
} from './pagePresence.js';
export type { PagePresenceOptions, PromptOptions } from './pagePresence.js';
export { createPresenceGroup, isPresenceGroup } from '../modules/videoplayer/videoplayer.presence.js';
export type { PresenceGroup, PresenceOptions } from '../modules/videoplayer/videoplayer.presence.js';
export { skinAll } from './skinAll.js';
export type { SkinAllOptions, SkinAllHandle } from './skinAll.js';
export { defineKuiPlayer } from './webComponent.js';
export type { KuiPlayerElement } from './webComponent.js';
