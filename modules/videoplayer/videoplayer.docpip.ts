/**
 * Document Picture-in-Picture: the whole player (controls included) in a small
 * always-on-top window. Chromium only, so everything here is feature-detected.
 */
export type DocumentPipWindow = Window;

export type DocumentPipApi = {
  requestWindow(options?: { width?: number; height?: number }): Promise<DocumentPipWindow>;
  window: DocumentPipWindow | null;
};

export function getDocumentPip(host: object | undefined = typeof window === 'undefined' ? undefined : window): DocumentPipApi | null {
  const api = (host as { documentPictureInPicture?: Partial<DocumentPipApi> } | undefined)?.documentPictureInPicture;
  return api && typeof api.requestWindow === 'function' ? (api as DocumentPipApi) : null;
}

/** A window size that keeps the player's aspect ratio and stays inside sane bounds. */
export function pipWindowSize(width: number, height: number): { width: number; height: number } {
  const w = Math.min(640, Math.max(320, Math.round(width) || 480));
  const ratio = width > 0 && height > 0 ? height / width : 9 / 16;
  return { width: w, height: Math.round(w * ratio) };
}

/**
 * Give the new document the player's look: every stylesheet of the page
 * (injected `<style>` and linked sheets alike) plus the `--kui-*` theme
 * variables, which usually live on an ancestor that stays behind.
 */
export function copyStylesToPip(
  target: Document, source: Document = document, container?: Element | null,
): void {
  for (const sheet of Array.from(source.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
      target.head.appendChild(style);
    } catch {
      // Cross-origin sheets refuse to expose their rules; link them instead.
      if (sheet.href) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
  if (container) {
    const computed = getComputedStyle(container);
    for (let i = 0; i < computed.length; i += 1) {
      const name = computed.item(i);
      if (name.startsWith('--kui-')) target.body.style.setProperty(name, computed.getPropertyValue(name));
    }
  }
  target.body.style.margin = '0';
  target.body.style.background = '#000';
}
