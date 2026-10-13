import { describe, expect, it } from 'vitest';
import { copyStylesToPip, getDocumentPip, pipWindowSize } from '../../modules/videoplayer/videoplayer.docpip';

describe('getDocumentPip', () => {
  it('is null without the API, and returns it when present', () => {
    expect(getDocumentPip({})).toBeNull();
    expect(getDocumentPip({ documentPictureInPicture: {} })).toBeNull();   // no requestWindow
    const api = { requestWindow: async () => ({}) as Window, window: null };
    expect(getDocumentPip({ documentPictureInPicture: api })).toBe(api);
    expect(getDocumentPip(undefined)).toBeNull();
  });
});

describe('pipWindowSize', () => {
  it('keeps the aspect ratio and clamps the width', () => {
    expect(pipWindowSize(1280, 720)).toEqual({ width: 640, height: 360 });
    expect(pipWindowSize(200, 100)).toEqual({ width: 320, height: 160 });
    expect(pipWindowSize(480, 360)).toEqual({ width: 480, height: 360 });
  });
  it('survives a not-yet-measured player', () => {
    expect(pipWindowSize(0, 0)).toEqual({ width: 480, height: 270 });
  });
});

describe('copyStylesToPip', () => {
  it('copies stylesheets and the --kui theme variables into the new document', () => {
    const style = document.createElement('style');
    style.textContent = '.kui-player { color: red; }';
    document.head.appendChild(style);
    const player = document.createElement('div');
    player.style.setProperty('--kui-accent', '#ff0000');
    document.body.appendChild(player);

    const target = document.implementation.createHTMLDocument('pip');
    copyStylesToPip(target, document, player);

    expect(Array.from(target.head.querySelectorAll('style')).some((s) => s.textContent?.includes('.kui-player'))).toBe(true);
    expect(target.body.style.margin).toBe('0px');
    style.remove();
    player.remove();
  });
});
