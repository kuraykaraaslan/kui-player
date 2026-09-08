import { useEffect, useState } from 'react';

/**
 * Fetch and parse a WebVTT sidecar (chapters, storyboard). Returns an empty
 * result until it arrives, and never throws into render: a missing chapter file
 * should cost the viewer a feature, not the player.
 *
 * The request goes to a URL the consumer supplied, which is the only kind of
 * request this library makes.
 */
export function useVttResource<T>(
  url: string | undefined,
  parse: (text: string, url: string) => T,
  empty: T,
): T {
  // Keyed by URL, so a change is reflected immediately rather than after an
  // effect has had a chance to clear the previous file's data.
  const [loaded, setLoaded] = useState<{ url: string; value: T } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then((text) => { if (!cancelled) setLoaded({ url, value: parse(text, url) }); })
      .catch(() => { if (!cancelled) setLoaded({ url, value: empty }); });

    return () => { cancelled = true; controller.abort(); };
    // `parse` and `empty` are module-level constants at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return url && loaded?.url === url ? loaded.value : empty;
}
