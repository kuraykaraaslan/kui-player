import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../../react';
import { emit } from '../setup';

const SRC = 'https://example.com/video.mp4';

function renderPlayer(props: Partial<React.ComponentProps<typeof VideoPlayer>> = {}) {
  const utils = render(<VideoPlayer src={SRC} title="Big Buck Bunny" enableCast={false} {...props} />);
  const video = utils.container.querySelector('video') as HTMLVideoElement;
  return { ...utils, video };
}

describe('controls reflect player state', () => {
  it('shows play, then pause once the element reports playback', async () => {
    const { video } = renderPlayer();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    emit(video, 'play', { paused: false });
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('renders the elapsed and total time from the element', async () => {
    const { video, container } = renderPlayer();
    emit(video, 'loadedmetadata', { duration: 125 });
    emit(video, 'timeupdate', { currentTime: 65 });
    await waitFor(() => {
      expect(container.querySelector('.kui-time')).toHaveTextContent('1:05/2:05');
    });
  });

  it('reflects mute state on the volume control', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    await user.click(screen.getByRole('button', { name: 'Mute' }));
    expect(video.muted).toBe(true);
    expect(await screen.findByRole('button', { name: 'Unmute' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('0');
  });

  it('drives the element from the play button', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(video.paused).toBe(false);
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(video.paused).toBe(true);
  });

  it('seeks by ten seconds from the skip buttons', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    emit(video, 'loadedmetadata', { duration: 100 });
    await user.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
    expect(video.currentTime).toBe(10);
    await user.click(screen.getByRole('button', { name: 'Rewind 10 seconds' }));
    expect(video.currentTime).toBe(0);
  });

  it('surfaces a media error with a working retry', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    emit(video, 'error', { error: { code: 4 } as MediaError });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This video is unavailable');
    expect(alert).toHaveTextContent('MEDIA_ERR_SRC_NOT_SUPPORTED');

    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

describe('settings panel', () => {
  const QUALITIES = [{ label: '1080p', value: '1080' }, { label: '720p', value: '720' }];
  const SUBTITLES = [{ label: 'English', srclang: 'en', src: '/en.vtt' }];

  it('navigates into a submenu and back', async () => {
    const user = userEvent.setup();
    renderPlayer({ qualities: QUALITIES });
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const quality = await screen.findByRole('menuitem', { name: /Quality/ });
    await user.click(quality);
    expect(await screen.findByRole('menuitemradio', { name: '1080p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quality' }));
    expect(await screen.findByRole('menuitem', { name: /Playback Speed/ })).toBeInTheDocument();
  });

  it('applies a quality choice and reports it', async () => {
    const user = userEvent.setup();
    const onQualityChange = vi.fn();
    renderPlayer({ qualities: QUALITIES, onQualityChange });

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Quality/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: '720p' }));

    expect(onQualityChange).toHaveBeenCalledWith('720');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('applies a playback speed to the element', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Playback Speed/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: '1.5×' }));
    expect(video.playbackRate).toBe(1.5);
  });

  it('closes on Escape and on an outside click', async () => {
    const user = userEvent.setup();
    renderPlayer({ qualities: QUALITIES, subtitles: SUBTITLES });

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('offers subtitle entries only when tracks exist', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPlayer();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Subtitles/ })).not.toBeInTheDocument();

    rerender(<VideoPlayer src={SRC} enableCast={false} subtitles={SUBTITLES} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('menuitem', { name: /Subtitles/ })).toBeInTheDocument();
  });
});

describe('keyboard shortcuts', () => {
  it('plays, seeks, mutes and adjusts volume while the player has focus', async () => {
    const user = userEvent.setup();
    const { video, container } = renderPlayer();
    emit(video, 'loadedmetadata', { duration: 100 });
    const player = container.querySelector('.kui-player') as HTMLElement;
    player.focus();

    await user.keyboard('{ }');
    expect(video.paused).toBe(false);
    await user.keyboard('k');
    expect(video.paused).toBe(true);

    await user.keyboard('{ArrowRight}');
    expect(video.currentTime).toBe(10);
    await user.keyboard('{ArrowLeft}');
    expect(video.currentTime).toBe(0);

    await user.keyboard('m');
    expect(video.muted).toBe(true);

    video.muted = false;
    await user.keyboard('{ArrowDown}');
    expect(video.volume).toBeCloseTo(0.9);
  });

  it('does nothing while focus is outside the player', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    await user.keyboard('{ }');
    expect(video.paused).toBe(true);
    outside.remove();
  });

  it('leaves a focused slider to handle its own arrow keys', async () => {
    const user = userEvent.setup();
    const { video } = renderPlayer();
    emit(video, 'loadedmetadata', { duration: 100 });
    const seek = screen.getByRole('slider', { name: 'Seek' });
    seek.focus();
    await user.keyboard('{ArrowRight}');
    // 5s from the slider's own handler, not 10s from the global shortcut.
    expect(video.currentTime).toBe(5);
    await user.keyboard('{End}');
    expect(video.currentTime).toBe(100);
    await user.keyboard('{Home}');
    expect(video.currentTime).toBe(0);
  });
});

describe('subtitles', () => {
  it('renders the active cue as an overlay', async () => {
    const { video, container } = renderPlayer({
      subtitles: [{ label: 'English', srclang: 'en', src: '/en.vtt' }],
    });

    // jsdom parses no WebVTT, so drive the track the way the browser would.
    const track = video.textTracks[0] as TextTrack & { activeCues: unknown };
    Object.defineProperty(track, 'activeCues', {
      configurable: true,
      value: [{ text: 'Hello <b>world</b>' }],
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'English' }));

    track.dispatchEvent(new Event('cuechange'));
    await waitFor(() => {
      expect(container.querySelector('.kui-subtitle-text')).toHaveTextContent('Hello world');
    });
  });
});

describe('styling contract', () => {
  it('injects the stylesheet once, and not at all when asked not to', () => {
    renderPlayer();
    renderPlayer();
    expect(document.querySelectorAll('[data-kui-player-styles]')).toHaveLength(1);
    expect(document.querySelector('[data-kui-player-styles]')?.textContent).toContain('.kui-player');
  });

  it('scopes every class under the kui- prefix', () => {
    const { container } = renderPlayer({ qualities: [{ label: '1080p', value: '1080' }] });
    const classes = new Set<string>();
    container.querySelectorAll('[class]').forEach((el) => {
      el.getAttribute('class')?.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    });
    const foreign = [...classes].filter((c) => !c.startsWith('kui-') && c !== 'is-active' && c !== 'is-hidden' && c !== 'is-playing' && c !== 'is-open' && c !== 'is-raised' && c !== 'is-selected');
    expect(foreign).toEqual([]);
  });
});

describe('theming', () => {
  // jsdom does not resolve `var()` in computed custom properties, so the
  // *behaviour* is covered end-to-end. What is checked here is the structure
  // that behaviour depends on, which is exactly what a refactor would break.
  it('reads the public tokens instead of redeclaring them', () => {
    render(<VideoPlayer src={SRC} enableCast={false} />);
    const css = document.querySelector('[data-kui-player-styles]')?.textContent ?? '';

    // A declaration of the public name on the player itself would beat any
    // value inherited from an ancestor — the documented way to theme it.
    expect(css).not.toMatch(/[{;]\s*--kui-[a-z-]+\s*:\s*[^v]/);
    expect(css).toMatch(/--_kui-accent:\s*var\(--kui-accent,\s*#3b82f6\)/);
    expect(css).toMatch(/background:\s*var\(--_kui-accent\)/);
  });

  it('exposes every documented token as an overridable input', () => {
    render(<VideoPlayer src={SRC} enableCast={false} />);
    const css = document.querySelector('[data-kui-player-styles]')?.textContent ?? '';
    for (const token of [
      'accent', 'bg', 'surface', 'surface-raised', 'border', 'text', 'text-muted',
      'text-faint', 'focus', 'radius', 'radius-sm', 'control-size', 'icon-size',
      'font', 'font-size', 'transition', 'scrim',
    ]) {
      expect(css, `--kui-${token} is not overridable`)
        .toMatch(new RegExp(`--_kui-${token}:\\s*var\\(--kui-${token},`));
    }
  });
});
