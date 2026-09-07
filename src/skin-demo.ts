/*
 * The skin-mode demo. It uses the same entry point a no-build page would get
 * from the CDN bundle — `window.kuiPlayer` — so what you see here is exactly
 * what one <script> tag does on someone else's site.
 */
import '../embed/index.js';

const toggle = document.getElementById('toggle') as HTMLButtonElement;
const accentButton = document.getElementById('accent') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLElement;
const addButton = document.getElementById('add') as HTMLButtonElement;
const late = document.getElementById('late') as HTMLElement;

const ACCENTS = [
  { label: 'orange', value: '#f97316' },
  { label: 'blue', value: '#3b82f6' },
  { label: 'pink', value: '#ec4899' },
];
let accentIndex = 0;
let skins: ReturnType<NonNullable<typeof window.kuiPlayer>['skinAll']> | null = null;

function report(): void {
  status.textContent = skins
    ? `Skinned ${skins.count} video${skins.count === 1 ? '' : 's'} — one chrome, ${skins.count} pipelines untouched.`
    : 'Not skinned — these are the browser’s own controls.';
}

function start(): void {
  skins = window.kuiPlayer?.skinAll('video', { accent: ACCENTS[accentIndex]!.value }) ?? null;
  toggle.textContent = 'Remove the skin';
  toggle.setAttribute('aria-pressed', 'true');
  report();
}

function stop(): void {
  skins?.stop();
  skins = null;
  toggle.textContent = 'Skin every video';
  toggle.setAttribute('aria-pressed', 'false');
  report();
}

toggle.addEventListener('click', () => (skins ? stop() : start()));

accentButton.addEventListener('click', () => {
  accentIndex = (accentIndex + 1) % ACCENTS.length;
  accentButton.textContent = `Accent: ${ACCENTS[accentIndex]!.label}`;
  if (skins) { stop(); start(); }
});

let added = 0;
addButton.addEventListener('click', () => {
  added += 1;
  const video = document.createElement('video');
  video.src = 'https://media.w3.org/2010/05/video/movie_300.mp4';
  video.poster = 'https://media.w3.org/2010/05/video/poster.png';
  video.preload = 'metadata';
  video.controls = true;
  video.style.marginTop = '0.75rem';
  late.appendChild(video);
  // No manual call: the observer picks it up. Report once it has.
  setTimeout(report, 50);
  if (added >= 3) addButton.disabled = true;
});

report();
