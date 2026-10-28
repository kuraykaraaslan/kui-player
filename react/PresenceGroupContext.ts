import { createContext, useContext } from 'react';
import type { PresenceGroup } from '../modules/videoplayer/videoplayer.presence.js';

/** The group a `<PresenceGroupProvider>` shares with every player below it. */
export const PresenceGroupContext = createContext<PresenceGroup | null>(null);

/** The presence group of the nearest provider, or `null` outside one. */
export function usePresenceGroup(): PresenceGroup | null {
  return useContext(PresenceGroupContext);
}
