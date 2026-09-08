import { mountSkin, type SkinOptions } from './mountSkin.js';

/**
 * `<kui-player src="…">` — the player as a custom element.
 *
 * It renders a real `<video>` and skins it, which means the element behaves
 * like a `<video>` for everything that matters: assign `src`, call `play()`,
 * listen for `timeupdate`. Angular, Vue, Svelte and plain HTML all consume a
 * custom element natively, so this is the wrapper for every framework that
 * does not need a bespoke one.
 */
export class KuiPlayerElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['src', 'poster', 'title', 'accent', 'autoplay', 'muted', 'loop', 'controls', 'speed'];
  }

  /** The underlying media element, for anyone who wants the real thing. */
  readonly video: HTMLVideoElement = document.createElement('video');
  private unmount: (() => void) | null = null;

  connectedCallback(): void {
    if (this.unmount) return;
    this.style.display = this.style.display || 'block';
    this.style.position = this.style.position || 'relative';

    this.video.style.cssText = 'width:100%;height:100%;display:block;background:#000;';
    this.video.playsInline = true;
    this.syncAttributes();
    if (!this.contains(this.video)) this.appendChild(this.video);

    this.unmount = mountSkin(this.video, this.skinOptions());
  }

  disconnectedCallback(): void {
    this.unmount?.();
    this.unmount = null;
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.syncAttributes();
    // Options are read at mount time, so a changed accent means a remount —
    // cheap, and it keeps the element's behaviour predictable.
    if (this.unmount) {
      this.unmount();
      this.unmount = mountSkin(this.video, this.skinOptions());
    }
  }

  // ── the parts of the media API worth forwarding ──
  get src(): string { return this.video.src; }
  set src(value: string) { this.video.src = value; }
  get currentTime(): number { return this.video.currentTime; }
  set currentTime(value: number) { this.video.currentTime = value; }
  get paused(): boolean { return this.video.paused; }
  play(): Promise<void> { return this.video.play(); }
  pause(): void { this.video.pause(); }

  private skinOptions(): SkinOptions {
    const accent = this.getAttribute('accent');
    const speed = this.getAttribute('speed');
    return {
      ...(accent ? { accent } : {}),
      ...(speed ? { defaultSpeed: Number(speed) } : {}),
      cast: this.hasAttribute('cast'),
      title: this.getAttribute('title') ?? undefined,
    };
  }

  private syncAttributes(): void {
    const src = this.getAttribute('src');
    if (src && this.video.getAttribute('src') !== src) this.video.setAttribute('src', src);
    const poster = this.getAttribute('poster');
    if (poster) this.video.poster = poster;
    this.video.autoplay = this.hasAttribute('autoplay');
    this.video.loop = this.hasAttribute('loop');
    this.video.muted = this.hasAttribute('muted');
  }
}

/** Register the element. Safe to call more than once. */
export function defineKuiPlayer(tagName = 'kui-player'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  customElements.define(tagName, KuiPlayerElement);
}
