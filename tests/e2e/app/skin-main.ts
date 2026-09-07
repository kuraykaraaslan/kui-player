/*
 * The skin-mode harness. It imports the single-script entry point, so the specs
 * exercise exactly what a `<script>` tag on someone else's page would install.
 */
import '../../../embed/index.js';

const params = new URLSearchParams(location.search);
type Handle = ReturnType<NonNullable<typeof window.kuiPlayer>['skinAll']>;
let handle: Handle | null = null;

const testApi = {
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
