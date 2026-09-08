#!/usr/bin/env node
/*
 * Loads what would be published and checks it works.
 *
 * Typecheck, tests and `publint` all inspect the *sources* or the package
 * manifest; none of them import a built file. A broken chunk reference, a
 * mangled entry or an embed bundle that throws on load would sail past every
 * other gate and land on npm. This is the last gate before that.
 *
 *   node scripts/check-artifacts.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const load = (file) => import(pathToFileURL(resolve(root, file)).href);

let failed = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
}

// ── the vanilla core ─────────────────────────────────────────────────────────
const core = await load('dist/index.js');
check('core exports the engine', typeof core.VideoPlayerEngine === 'function');
check('core exports the store factory', typeof core.createVideoPlayerStore === 'function');
check('core exports the adapters', typeof core.createHlsAdapter === 'function' && typeof core.createDashAdapter === 'function');
check('core exports the parsers', typeof core.parseVtt === 'function' && typeof core.parseSubtitles === 'function');
check('core reports the published version', core.PLAYER_META?.version === pkg.version,
  `${core.PLAYER_META?.version} vs ${pkg.version}`);

// The engine must be constructible with no DOM at all — this is the SSR promise.
const engine = new core.VideoPlayerEngine();
check('engine constructs without a DOM', engine.store.getState().playing === false);
check('engine exposes the event API', typeof engine.on === 'function' && typeof engine.off === 'function');

// ── the React subpath ────────────────────────────────────────────────────────
const react = await load('dist/react/index.js');
check('react subpath exports the component', typeof react.VideoPlayer === 'function');
check('react subpath exports the chrome', typeof react.VideoPlayerChrome === 'function');
check('react subpath exports the hooks', typeof react.useVideoPlayerEngine === 'function');
check('react subpath ships the stylesheet', typeof react.PLAYER_CSS === 'string' && react.PLAYER_CSS.includes('.kui-player'));
check('react entry declares the client boundary',
  readFileSync(resolve(root, 'dist/react/index.js'), 'utf8').startsWith('"use client"'));

// ── skin mode, locales, wrappers ─────────────────────────────────────────────
const skin = await load('dist/skin/index.js');
check('skin exports mountSkin and skinAll', typeof skin.mountSkin === 'function' && typeof skin.skinAll === 'function');
check('skin exports the custom element', typeof skin.defineKuiPlayer === 'function');

const locales = await load('dist/locales/index.js');
for (const tag of ['tr', 'de', 'es', 'fr', 'ar']) {
  check(`locale ${tag} is present and complete`, typeof locales[tag]?.play === 'string');
}
check('the Arabic locale is right-to-left', locales.ar?.dir === 'rtl');

check('vue wrapper loads', typeof (await load('dist/wrappers/vue.js')).KuiPlayer === 'object');
check('svelte wrapper loads', typeof (await load('dist/wrappers/svelte.js')).kuiPlayer === 'function');

// ── the single-script embed, in a real document ──────────────────────────────
const dom = new JSDOM('<!doctype html><html><body><video id="v"></video></body></html>', {
  runScripts: 'outside-only',
  url: 'https://example.test/',
});
dom.window.eval(readFileSync(resolve(root, 'dist/embed.js'), 'utf8'));
const api = dom.window.kuiPlayer;
check('embed installs window.kuiPlayer', typeof api === 'object');
check('embed reports the published version', api?.version === pkg.version, `${api?.version} vs ${pkg.version}`);
check('embed exposes its API', ['mount', 'unmount', 'unmountAll', 'isMounted', 'skinAll', 'define']
  .every((name) => typeof api?.[name] === 'function'));
check('embed keeps the pre-0.1.0 global as an alias', dom.window.__tepegozVideoPlayer === api);

// ── every declared export must resolve ───────────────────────────────────────
for (const [subpath, entry] of Object.entries(pkg.exports)) {
  const targets = typeof entry === 'string' ? [entry] : Object.values(entry);
  for (const target of targets) {
    try {
      readFileSync(resolve(root, target));
    } catch {
      check(`exports "${subpath}" → ${target}`, false, 'missing from the build');
    }
  }
}
check('every entry in "exports" resolves to a built file', true);

console.log(failed === 0
  ? '\n[check-artifacts] the published package loads and behaves'
  : `\n[check-artifacts] ${failed} problem(s) — do not publish`);
process.exit(failed === 0 ? 0 : 1);
