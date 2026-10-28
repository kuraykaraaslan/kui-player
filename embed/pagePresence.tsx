import { createRoot } from 'react-dom/client';
import { PresencePrompt } from '../react/presence.js';
import type { PartialDictionary } from '../react/i18n/index.js';
import {
  createPresenceGroup, isPresenceGroup, type PresenceGroup, type PresenceOptions,
} from '../modules/videoplayer/videoplayer.presence.js';

/*
 * The "Still watching?" check for players that are not React components.
 *
 * A group is one timer for any number of players; the prompt is the single
 * page-level question that goes with it. React users get both from
 * `<PresenceGroupProvider>`. Everything else (skin mode, the custom element, the
 * Vue and Svelte wrappers) creates the group, mounts the prompt once, and hands
 * the group to each player.
 */

export type PromptOptions = {
  /** A dictionary for the prompt's text — the same value you give the players. */
  locale?: PartialDictionary;
  /** Inject the player stylesheet into the document head (default `true`). */
  injectStyles?: boolean;
};

export type PagePresenceOptions = PresenceOptions & PromptOptions & {
  /** Render the page-level prompt (default `true`); `false` to place your own. */
  prompt?: boolean;
};

/**
 * Render the one page-level prompt for `group`. It appears over the page while
 * the group is asking and is gone otherwise. Returns the function that removes it.
 */
export function mountPresencePrompt(group: PresenceGroup, options: PromptOptions = {}): () => void {
  const host = document.createElement('div');
  host.setAttribute('data-kui-presence-prompt', '');
  host.hidden = true;   // the prompt portals itself into <body>; this node only owns the React root
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<PresencePrompt group={group} locale={options.locale} injectStyles={options.injectStyles} />);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    root.unmount();
    host.remove();
  };
}

/**
 * A group with its prompt: what `<PresenceGroupProvider everyMs graceMs>` makes in
 * React. `dispose()` also takes the prompt away.
 */
export function createPagePresenceGroup(options: PagePresenceOptions): PresenceGroup {
  const { prompt = true, locale, injectStyles, ...timing } = options;
  const group = createPresenceGroup(timing);
  const unmount = prompt ? mountPresencePrompt(group, { locale, injectStyles }) : null;
  const dispose = group.dispose.bind(group);
  group.dispose = () => { unmount?.(); dispose(); };
  return group;
}

let pageGroup: PresenceGroup | null = null;
let pageOwned = false;

/** The group every skinned player joins unless it says otherwise, or `null`. */
export function getPagePresence(): PresenceGroup | null { return pageGroup; }

/**
 * Make `input` the page's group: skinned players, `<kui-player>` elements and
 * wrapper components that were not given a `presence` of their own join it. Pass
 * options to have the group and its prompt made for you, a group you made
 * yourself, or `null` to remove it. Players already mounted keep the group they
 * joined; set this before they mount.
 */
export function setPagePresence(input: PagePresenceOptions | PresenceGroup | null): PresenceGroup | null {
  if (pageOwned) pageGroup?.dispose();
  if (!input) {
    pageGroup = null;
    pageOwned = false;
    return null;
  }
  pageOwned = !isPresenceGroup(input);
  pageGroup = isPresenceGroup(input) ? input : createPagePresenceGroup(input);
  return pageGroup;
}
