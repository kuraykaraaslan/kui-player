import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { VideoPlayer } from '../../react';
import { emit } from '../setup';

const SRC = 'https://example.com/video.mp4';
const QUALITIES = [{ label: '1080p', value: '1080' }, { label: '720p', value: '720' }];
const SUBTITLES = [{ label: 'English', srclang: 'en', src: '/en.vtt' }];

/**
 * axe needs the real stylesheet to judge contrast and visibility, and the
 * component injects it into `document.head`, so scanning the container in place
 * is enough. `color-contrast` is left on deliberately — it is the rule the dark
 * chrome is most likely to regress.
 */
async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { region: { enabled: false } },   // the player is not a landmark
    resultTypes: ['violations'],
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`);
}

describe('accessibility', () => {
  it('has no violations at rest', async () => {
    const { container } = render(
      <VideoPlayer src={SRC} title="Big Buck Bunny" enableCast={false} qualities={QUALITIES} subtitles={SUBTITLES} />,
    );
    expect(await scan(container)).toEqual([]);
  });

  it('has no violations with the settings menu open', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} qualities={QUALITIES} subtitles={SUBTITLES} />,
    );
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('menu');
    expect(await scan(container)).toEqual([]);
  });

  it('has no violations with the About dialog open', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /About/ }));
    await screen.findByRole('dialog');
    expect(await scan(container)).toEqual([]);
  });

  it('has no violations while showing an error', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'error', { error: { code: 2 } as MediaError });
    await screen.findByRole('alert');
    expect(await scan(container)).toEqual([]);
  });

  it('gives the seek bar a spoken position, not a bare percentage', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 260 });
    emit(video, 'timeupdate', { currentTime: 134 });
    await waitFor(() => {
      expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuetext', '2:14 of 4:20');
    });
  });

  it('announces state changes in a polite live region', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} qualities={QUALITIES} />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).toBeInTheDocument();
    expect(live.textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(live).toHaveTextContent('Playing'));

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(live).toHaveTextContent('Paused'));

    await user.click(screen.getByRole('button', { name: 'Mute' }));
    await waitFor(() => expect(live).toHaveTextContent('Muted'));

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Quality/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: '720p' }));
    await waitFor(() => expect(live).toHaveTextContent('Quality 720p'));
  });

  it('keeps focus inside the settings menu and returns it on close', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} qualities={QUALITIES} />);
    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    await user.click(settingsButton);

    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));

    // Tab all the way round: focus must never escape the panel.
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(menu.contains(document.activeElement)).toBe(true);
    }

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(settingsButton);
  });

  it('keeps focus inside the About dialog', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /About/ }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('lets the controls hide again after a mere click', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} autoHideControls />);
    const video = container.querySelector('video') as HTMLVideoElement;

    // Clicking Play focuses the button, but a pointer is not a keyboard: the
    // chrome must still fade, or auto-hide would never fire for mouse users.
    await user.click(screen.getByRole('button', { name: 'Play' }));
    emit(video, 'play', { paused: false });
    await waitFor(
      () => expect(container.querySelector('.kui-chrome')).toHaveClass('is-hidden'),
      { timeout: 5000 },
    );
  }, 12000);

  it('reaches every control by keyboard alone', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} qualities={QUALITIES} />);
    const player = container.querySelector('.kui-player') as HTMLElement;
    player.focus();

    const reached = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement | null;
      if (el && player.contains(el)) {
        reached.add(el.getAttribute('aria-label') ?? el.tagName.toLowerCase());
      }
    }

    for (const label of ['Play', 'Mute', 'Volume', 'Seek', 'Settings', 'Enter fullscreen']) {
      expect([...reached], `${label} unreachable by Tab`).toContain(label);
    }
  });

  it('does not hide the controls while a control holds keyboard focus', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} autoHideControls />);
    const video = container.querySelector('video') as HTMLVideoElement;

    const player = container.querySelector('.kui-player') as HTMLElement;
    player.focus();
    await user.tab();   // keyboard focus onto the first control
    emit(video, 'play', { paused: false });
    await new Promise((r) => setTimeout(r, 3200));
    expect(container.querySelector('.kui-chrome')).not.toHaveClass('is-hidden');

    // …and resumes hiding once focus leaves.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    await user.click(outside);
    await waitFor(
      () => expect(container.querySelector('.kui-chrome')).toHaveClass('is-hidden'),
      { timeout: 4000 },
    );
    outside.remove();
  }, 12000);
});
