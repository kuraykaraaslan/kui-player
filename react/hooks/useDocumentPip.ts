import { useCallback, useLayoutEffect, useState } from 'react';
import {
  copyStylesToPip, getDocumentPip, pipWindowSize, type DocumentPipWindow,
} from '../../modules/videoplayer/videoplayer.docpip.js';

type Options = { enabled: boolean };

/**
 * Document Picture-in-Picture without re-creating the player.
 *
 * React delegates events at a root (or portal) container, and only for fibers
 * *below* it — so a node moved by hand into another document would be dead to
 * React. Instead the player is rendered, always, into a portal whose container
 * (`host`) we own; entering PiP moves that container, listeners and all, into
 * the PiP window, and leaving moves it back to `anchor`, its slot in the page.
 * The `<video>` is never re-created, so playback carries straight on.
 */
export function useDocumentPip({ enabled }: Options) {
  const supported = enabled && getDocumentPip() !== null;
  // Created once, during the first render on the client. On the server there is
  // no document, so the page renders just the anchor and the player mounts after hydration.
  const [host] = useState<HTMLElement | null>(() => {
    if (!enabled || typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.style.display = 'contents';   // the wrapper must not change the page's layout
    return el;
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pipWindow, setPipWindow] = useState<DocumentPipWindow | null>(null);
  const [height, setHeight] = useState(0);

  // A layout effect on purpose: its cleanup runs before React tears the tree down.
  useLayoutEffect(() => {
    if (!host || !anchor) return;
    if (!pipWindow) {
      if (host.parentNode !== anchor) anchor.appendChild(host);
      return;
    }
    pipWindow.document.body.append(host);
    host.querySelector<HTMLElement>('.kui-player')?.focus({ preventScroll: true });

    const giveBack = () => {
      anchor.appendChild(host);
      setPipWindow(null);
    };
    pipWindow.addEventListener('pagehide', giveBack);
    return () => {
      pipWindow.removeEventListener('pagehide', giveBack);
      if (!pipWindow.closed) pipWindow.close();
    };
  }, [host, anchor, pipWindow]);

  const toggle = useCallback(async () => {
    if (pipWindow) { pipWindow.close(); return; }
    const api = getDocumentPip();
    const player = host?.querySelector<HTMLElement>('.kui-player');
    if (!api || !player) return;
    const rect = player.getBoundingClientRect();
    setHeight(rect.height);
    try {
      const next = await api.requestWindow(pipWindowSize(rect.width, rect.height));
      copyStylesToPip(next.document, document, player);
      setPipWindow(next);
    } catch {
      // Refused (no user activation, already open elsewhere…): stay in the page.
    }
  }, [pipWindow, host]);

  return {
    supported,
    /** The portal container for the player; `null` when the feature is off or on the server. */
    host,
    active: pipWindow !== null,
    pipDocument: pipWindow?.document ?? null,
    placeholderHeight: height,
    setAnchor,
    toggle,
  };
}
