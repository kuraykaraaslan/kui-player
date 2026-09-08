import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../../react';
import { emit } from '../setup';

const SRC = 'https://example.com/video.mp4';

describe('chapters', () => {
  const chapters = [
    { start: 0, end: 30, title: 'Opening' },
    { start: 30, end: 90, title: 'The middle bit' },
  ];

  it('segments the seek bar and lists the chapters', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} chapters={chapters} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 90 });

    await waitFor(() => expect(container.querySelectorAll('.kui-chapter')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Chapters/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: /The middle bit/ }));

    expect(video.currentTime).toBe(30);
  });

  it('shows no chapter UI when there are none', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    expect(container.querySelectorAll('.kui-chapter')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: /Chapters/ })).not.toBeInTheDocument();
  });
});

describe('subtitle appearance', () => {
  const subtitles = [{ label: 'English', srclang: 'en', src: '/en.vtt' }];

  it('applies colour, background and edge to the cue overlay', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    const video = container.querySelector('video') as HTMLVideoElement;

    const track = video.textTracks[0] as TextTrack & { activeCues: unknown };
    Object.defineProperty(track, 'activeCues', { configurable: true, value: [{ text: 'Hello' }] });

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'English' }));
    track.dispatchEvent(new Event('cuechange'));

    const cue = await waitFor(() => {
      const node = container.querySelector('.kui-subtitle-text');
      expect(node).toHaveTextContent('Hello');
      return node as HTMLElement;
    });
    expect(cue.style.color).toBe('rgb(255, 255, 255)');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitle Style/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Yellow' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Outline' }));

    await waitFor(() => {
      const node = container.querySelector('.kui-subtitle-text') as HTMLElement;
      expect(node.style.color).toBe('rgb(255, 235, 59)');
      expect(node.style.textShadow).toContain('#000');
    });
  });
});

describe('playlist', () => {
  const playlist = [
    { src: 'https://example.com/one.mp4', title: 'One' },
    { src: 'https://example.com/two.mp4', title: 'Two' },
  ];

  it('plays the first item and offers the next when it ends', async () => {
    const onIndex = vi.fn();
    const { container } = render(
      <VideoPlayer playlist={playlist} enableCast={false} playlistCountdown={3} onPlaylistIndexChange={onIndex} />,
    );
    expect(container.querySelector('source')).toHaveAttribute('src', 'https://example.com/one.mp4');

    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 10 });
    // The playlist controller is a lazy chunk; nobody can finish a video before
    // it resolves, but a test can, so wait for it to be listening.
    await waitFor(() => expect(container.querySelector('video')).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 30));
    emit(video, 'ended', { paused: true });

    // The card names what is coming and counts down before advancing.
    await waitFor(() => expect(screen.getByText(/Two/)).toBeInTheDocument());
    await waitFor(() => expect(onIndex).toHaveBeenCalledWith(1), { timeout: 4000 });
    await waitFor(() => {
      expect(container.querySelector('source')).toHaveAttribute('src', 'https://example.com/two.mp4');
    });
  }, 12000);

  it('skips straight on when no countdown is asked for', async () => {
    const onIndex = vi.fn();
    const { container } = render(
      <VideoPlayer playlist={playlist} enableCast={false} playlistCountdown={0} onPlaylistIndexChange={onIndex} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 10 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    emit(video, 'ended', { paused: true });
    await waitFor(() => expect(onIndex).toHaveBeenCalledWith(1));
  });
});

describe('persistence', () => {
  it('writes nothing unless asked', async () => {
    localStorage.clear();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 600 });
    emit(video, 'timeupdate', { currentTime: 120 });
    await waitFor(() => expect(container.querySelector('.kui-player')).toBeInTheDocument());
    expect(localStorage.length).toBe(0);
  });

  it('offers to resume a stored position, and only on request', async () => {
    localStorage.clear();
    // Pre-seed the way a previous visit would have.
    const { PlayerStorage } = await import('../../modules/videoplayer/videoplayer.persist');
    new PlayerStorage({}).writePosition(SRC, 120, 600);

    const { container } = render(<VideoPlayer src={SRC} enableCast={false} persist />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 600 });

    const resume = await screen.findByRole('button', { name: 'Resume' });
    expect(screen.getByText(/2:00/)).toBeInTheDocument();
    expect(video.currentTime).toBe(0);   // nothing happens until asked

    await userEvent.setup().click(resume);
    expect(video.currentTime).toBe(120);
    localStorage.clear();
  });
});

describe('themes and slots', () => {
  it('marks the player with the chosen theme', () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} theme="cinema" />);
    expect(container.querySelector('.kui-player')).toHaveAttribute('data-kui-theme', 'cinema');
  });

  it('renders consumer nodes in the named slots', () => {
    const { container } = render(
      <VideoPlayer
        src={SRC}
        enableCast={false}
        slots={{
          top: <span data-testid="slot-top">top</span>,
          controlsEnd: <button type="button">Share</button>,
        }}
      />,
    );
    expect(screen.getByTestId('slot-top')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(container.querySelector('.kui-slot--controls-end')).toBeInTheDocument();
  });
});

describe('live streams', () => {
  it('replaces the clock with a live badge that jumps to the edge', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'seekable', {
      configurable: true,
      value: { length: 1, start: () => 0, end: () => 100 },
    });
    video.duration = Infinity;
    emit(video, 'durationchange', { duration: Infinity });
    emit(video, 'timeupdate', { currentTime: 40 });

    const badge = await screen.findByRole('button', { name: 'Go to live edge' });
    await userEvent.setup().click(badge);
    expect(video.currentTime).toBe(100);

    emit(video, 'timeupdate', { currentTime: 100 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'LIVE' })).toBeDisabled());
  });
});
