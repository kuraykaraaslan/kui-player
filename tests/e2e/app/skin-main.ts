/*
 * The skin-mode harness. It imports the single-script entry point, so the specs
 * exercise exactly what a `<script>` tag on someone else's page would install.
 */
import '../../../embed/index.js';

const params = new URLSearchParams(location.search);
(window as unknown as { __sourceChanges: number[] }).__sourceChanges = [];
type Handle = ReturnType<NonNullable<typeof window.kuiPlayer>['skinAll']>;
let handle: Handle | null = null;

/** Two addresses for the same clip, told apart by a query string the specs can read back. */
const ALTERNATES = [
  { label: 'Standard', src: '/media/clip.wav?hd=0' },
  { label: 'High', src: '/media/clip.wav?hd=1' },
];

const testApi = {
  /** `count` extra players that share the page's "Still watching?" (what `data-presence-*` on the script tag sets up). */
  presenceWall(count: number, everyMs: number, graceMs: number) {
    window.kuiPlayer?.setPagePresence({ everyMs, graceMs });
    const late = document.getElementById('late')!;
    for (let i = 0; i < count; i += 1) {
      const video = document.createElement('video');
      video.src = '/media/clip.wav';
      video.preload = 'metadata';
      video.className = 'wall';
      // `?optout=1`: the first one keeps out of the group by attribute.
      if (i === 0 && params.get('optout') === '1') video.setAttribute('data-kui-presence', 'off');
      late.appendChild(video);
    }
    handle = window.kuiPlayer?.skinAll('#late video') ?? null;
    return handle?.count ?? 0;
  },
  /** Skin `#one` with two alternate addresses; `prefer` plays the second in fullscreen. */
  alternates(prefer: boolean) {
    window.kuiPlayer?.mount(document.getElementById('one') as HTMLVideoElement, {
      sources: ALTERNATES,
      preferAlternateInFullscreen: prefer,
      onSourceChange: (index) => { (window as unknown as { __sourceChanges: number[] }).__sourceChanges.push(index); },
    });
  },
  skinAll(selector = 'video') {
    handle = window.kuiPlayer?.skinAll(selector, { accent: params.get('accent') ?? undefined }) ?? null;
    return handle?.count ?? 0;
  },
  stop() { handle?.stop(); handle = null; },
  count: () => handle?.count ?? 0,
  addVideo() {
    const video = document.createElement('video');
    video.src = '/media/clip.wav';
    video.preload = 'metadata';
    video.id = `late-${document.querySelectorAll('#late video').length}`;
    document.getElementById('late')!.appendChild(video);
  },
};

(window as unknown as { skinTest: typeof testApi }).skinTest = testApi;
if (params.get('auto') === '1') testApi.skinAll();
if (params.get('wall')) testApi.presenceWall(Number(params.get('wall')), Number(params.get('pe') ?? 5000), Number(params.get('pg') ?? 3000));
