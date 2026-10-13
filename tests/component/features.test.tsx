import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../../react';
import { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine';
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

  // The playlist controller is a lazy chunk; nobody can finish a video before
  // it resolves, but a test can. Wait until it has subscribed to `complete`
  // rather than guessing how long the chunk takes to load and mount.
  let on: MockInstance<VideoPlayerEngine['on']>;
  beforeEach(() => { on = vi.spyOn(VideoPlayerEngine.prototype, 'on'); });
  afterEach(() => { on.mockRestore(); });
  const playlistControllerListening = () =>
    waitFor(() => expect(on).toHaveBeenCalledWith('complete', expect.any(Function)));

  it('plays the first item and offers the next when it ends', async () => {
    const onIndex = vi.fn();
    const { container } = render(
      <VideoPlayer playlist={playlist} enableCast={false} playlistCountdown={3} onPlaylistIndexChange={onIndex} />,
    );
    expect(container.querySelector('source')).toHaveAttribute('src', 'https://example.com/one.mp4');

    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 10 });
    await playlistControllerListening();
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
    await playlistControllerListening();
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

describe('watermark', () => {
  it('renders the text inside the player container, so fullscreen keeps it', () => {
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} watermark={{ text: 'user-42' }} />,
    );
    return waitFor(() => {
      const mark = container.querySelector('.kui-player .kui-watermark');
      expect(mark?.textContent).toBe('user-42');
    });
  });

  it('pauses and rebuilds the mark when it is removed (pauseOnTamper)', async () => {
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} watermark={{ text: 'user-42', pauseOnTamper: true }} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    const pause = vi.spyOn(video, 'pause');
    const mark = await waitFor(() => {
      const el = container.querySelector('.kui-watermark');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    mark.remove();
    await waitFor(() => expect(pause).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('.kui-watermark')?.textContent).toBe('user-42'));
  });

  it('pauses when the mark is hidden with inline style', async () => {
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} watermark={{ text: 'user-42', pauseOnTamper: true }} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    const pause = vi.spyOn(video, 'pause');
    const mark = await waitFor(() => {
      const el = container.querySelector('.kui-watermark');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    mark.style.display = 'none';
    await waitFor(() => expect(pause).toHaveBeenCalled());
  });
});

describe('skippable chapters', () => {
  const chapters = [
    { start: 0, end: 20, title: 'Intro' },
    { start: 20, end: 90, title: 'Episode' },
    { start: 90, end: 100, title: 'Credits' },
  ];

  it('offers "Skip intro" inside the intro, seeks past it, and goes away after', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} chapters={chapters} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    emit(video, 'timeupdate', { currentTime: 5 });

    await user.click(await screen.findByRole('button', { name: 'Skip intro' }));
    expect(video.currentTime).toBe(20);
    emit(video, 'timeupdate', { currentTime: 20 });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Skip intro' })).not.toBeInTheDocument());
  });

  it('skips on its own with autoSkip', async () => {
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} chapters={chapters} skipSegments={{ autoSkip: true }} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    emit(video, 'timeupdate', { currentTime: 3 });
    await waitFor(() => expect(video.currentTime).toBe(20), { timeout: 4000 });
  });

  it('can be turned off', async () => {
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} chapters={chapters} skipSegments={false} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    emit(video, 'timeupdate', { currentTime: 5 });
    await waitFor(() => expect(container.querySelectorAll('.kui-chapter')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: 'Skip intro' })).not.toBeInTheDocument();
  });

  it('jumps between chapters with ] and [ and skips with s', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} chapters={chapters} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    emit(video, 'timeupdate', { currentTime: 5 });
    await waitFor(() => expect(container.querySelectorAll('.kui-chapter')).toHaveLength(3));
    (container.querySelector('.kui-player') as HTMLElement).focus();

    await user.keyboard('s');
    expect(video.currentTime).toBe(20);
    emit(video, 'timeupdate', { currentTime: 30 });
    await user.keyboard(']');
    expect(video.currentTime).toBe(90);
    emit(video, 'timeupdate', { currentTime: 91 });
    await user.keyboard('[[');
    expect(video.currentTime).toBe(20);   // 1 s into Credits: close to the start, so go to the previous chapter
  });
});

describe('credits start the playlist countdown early', () => {
  const playlist = [
    { src: 'https://example.com/one.mp4', title: 'One', chapters: [
      { start: 0, end: 50, title: 'Episode' }, { start: 50, end: 60, title: 'Credits' },
    ] },
    { src: 'https://example.com/two.mp4', title: 'Two' },
  ];

  it('moves on from the credits without waiting for the end', async () => {
    const onIndex = vi.fn();
    const { container } = render(
      <VideoPlayer playlist={playlist} enableCast={false} playlistCountdown={0} onPlaylistIndexChange={onIndex} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 60 });
    emit(video, 'timeupdate', { currentTime: 10 });
    // The credits listener is mounted lazily: keep nudging the playhead until it hears us.
    await waitFor(() => {
      emit(video, 'timeupdate', { currentTime: 52 });
      expect(onIndex).toHaveBeenCalledWith(1);
    });
  });
});
