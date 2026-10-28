"use client";

import { useMemo, useState, type ReactNode } from 'react';
import { PresenceGroupContext } from './PresenceGroupContext.js';
import PresenceCard from './parts/PresenceCard.js';
import { useStore } from './hooks/useStore.js';
import { usePlayerStyles } from './styles/index.js';
import { I18nProvider, resolveDictionary, type PartialDictionary } from './i18n/index.js';
import {
  createPresenceGroup, type PresenceGroup,
} from '../modules/videoplayer/videoplayer.presence.js';

export type PresencePromptProps = {
  group: PresenceGroup;
  /** A dictionary for the prompt's text — the same value you give the players. */
  locale?: PartialDictionary;
  /** Inject the player stylesheet (default `true`). */
  injectStyles?: boolean;
};

/**
 * The page-level "Still watching?" question for a group. A provider renders one
 * for you; use this directly only with `<PresenceGroupProvider prompt={false}>`
 * to put it somewhere else in the tree.
 */
export function PresencePrompt({ group, locale, injectStyles = true }: PresencePromptProps) {
  usePlayerStyles(injectStyles);
  const asking = useStore(group.store, (s) => s.phase === 'asking');
  const dictionary = useMemo(() => resolveDictionary(locale), [locale]);
  if (!asking) return null;
  return (
    <I18nProvider value={dictionary}>
      <PresenceCard group={group} mode="page" />
    </I18nProvider>
  );
}

export type PresenceGroupProviderProps = {
  /** An existing group (`createPresenceGroup()`); omit to have one made from `everyMs` / `graceMs`. */
  group?: PresenceGroup;
  /** Playback time before the question, ms. Used when `group` is not given. */
  everyMs?: number;
  /** Time to answer, ms. Used when `group` is not given. */
  graceMs?: number;
  /** Render the page-level prompt (default `true`). */
  prompt?: boolean;
  /** Dictionary for the prompt. */
  locale?: PartialDictionary;
  injectStyles?: boolean;
  children?: ReactNode;
};

/**
 * Every `<VideoPlayer>` below this shares one presence timer and one prompt:
 * a page with nine live tiles asks "Still watching?" once, and when nobody
 * answers within the grace period all nine stop playing and loading.
 *
 * ```tsx
 * <PresenceGroupProvider everyMs={10 * 60_000} graceMs={30_000}>
 *   {cameras.map((c) => <VideoPlayer key={c.id} src={c.src} adapters={adapters} />)}
 * </PresenceGroupProvider>
 * ```
 */
export function PresenceGroupProvider({
  group, everyMs, graceMs, prompt = true, locale, injectStyles, children,
}: PresenceGroupProviderProps) {
  // A group holds no resources until a player joins it and its timer stops when
  // the last one leaves, so there is nothing to dispose when this unmounts.
  const [own] = useState<PresenceGroup | null>(() =>
    (group ? null : createPresenceGroup({ everyMs: everyMs ?? Number.NaN, graceMs: graceMs ?? Number.NaN })));
  const active = group ?? own;
  if (!active) throw new Error('PresenceGroupProvider needs a group, or everyMs and graceMs');
  return (
    <PresenceGroupContext.Provider value={active}>
      {children}
      {prompt && <PresencePrompt group={active} locale={locale} injectStyles={injectStyles} />}
    </PresenceGroupContext.Provider>
  );
}
