import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

describe('mini player', () => {
  type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let callbacks: IOCallback[];
  let targets: Element[];
  const realIO = globalThis.IntersectionObserver;

  beforeEach(() => {
    callbacks = [];
    targets = [];
    globalThis.IntersectionObserver = class {
      constructor(cb: IOCallback) { callbacks.push(cb); }
      observe(el: Element) { targets.push(el); }
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => { globalThis.IntersectionObserver = realIO; });

  const scrollTo = (ratio: number) => {
    const last = callbacks[callbacks.length - 1];
    last?.([{ intersectionRatio: ratio, isIntersecting: ratio > 0 }]);
  };

  it('is off unless asked for', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    await waitFor(() => expect(container.querySelector('.kui-player')).toBeInTheDocument());
    expect(targets).toHaveLength(0);
  });

  it('floats while playing and scrolled away, and docks back when it returns', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} miniPlayer />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'play', { paused: false });
    await waitFor(() => expect(targets.length).toBeGreaterThan(0));

    act(() => scrollTo(0));
    await waitFor(() => expect(container.querySelector('.kui-player.is-mini')).toBeInTheDocument());
    expect(container.querySelector('.kui-mini-placeholder')).toBeInTheDocument();
    expect(container.querySelector('video')).toBe(video);   // same node: playback is not interrupted

    act(() => scrollTo(0.8));
    await waitFor(() => expect(container.querySelector('.is-mini')).not.toBeInTheDocument());
    expect(container.querySelector('.kui-mini-placeholder')).not.toBeInTheDocument();
  });

  it('does not float a paused player', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} miniPlayer />);
    await waitFor(() => expect(targets.length).toBeGreaterThan(0));
    act(() => scrollTo(0));
    expect(container.querySelector('.is-mini')).not.toBeInTheDocument();
  });

  it('closing pauses and keeps it docked until the player is seen again', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} miniPlayer />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const pause = vi.spyOn(video, 'pause');
    emit(video, 'play', { paused: false });
    await waitFor(() => expect(targets.length).toBeGreaterThan(0));
    act(() => scrollTo(0));
    await user.click(await screen.findByRole('button', { name: 'Close mini player' }));
    expect(pause).toHaveBeenCalled();
    await waitFor(() => expect(container.querySelector('.is-mini')).not.toBeInTheDocument());
  });
});

describe('dual-language subtitles', () => {
  const subtitles = [
    { label: 'English', srclang: 'en', src: '/en.srt' },
    { label: 'Türkçe', srclang: 'tr', src: '/tr.vtt' },
  ];
  const files: Record<string, string> = {
    '/en.srt': '1\n00:00:01,000 --> 00:00:04,000\nHello there\n',
    // Deliberately offset from the English cue: the two tracks keep their own clocks.
    '/tr.vtt': 'WEBVTT\n\n00:00:02.000 --> 00:00:05.000\nMerhaba\n',
  };
  let fetchSpy: MockInstance<typeof fetch>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return new Response(files[url] ?? '', { status: files[url] ? 200 : 404 });
    });
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  async function pick(user: ReturnType<typeof userEvent.setup>, menuName: RegExp, optionName: string, nth = 0) {
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: menuName }));
    await user.click((await screen.findAllByRole('menuitemradio', { name: optionName }))[nth]!);
  }

  it('shows both lines, each on its own timing, with the second above the first', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 60 });

    await pick(user, /Subtitles/, 'English');
    await pick(user, /Subtitles/, 'Türkçe', 1);   // second list: the second-language section

    emit(video, 'timeupdate', { currentTime: 1.5 });
    await waitFor(() => expect(container.querySelector('.kui-subtitle-text:not(.kui-subtitle-text--secondary)')?.textContent).toBe('Hello there'));
    expect(container.querySelector('.kui-subtitle-text--secondary')).toBeNull();   // Turkish starts at 2 s

    emit(video, 'timeupdate', { currentTime: 3 });
    await waitFor(() => expect(container.querySelector('.kui-subtitle-text--secondary')?.textContent).toBe('Merhaba'));
    const texts = Array.from(container.querySelectorAll('.kui-subtitles .kui-subtitle-text')).map((n) => n.textContent);
    expect(texts).toEqual(['Merhaba', 'Hello there']);

    emit(video, 'timeupdate', { currentTime: 4.5 });   // English over, Turkish still on
    await waitFor(() => expect(container.querySelector('.kui-subtitle-text:not(.kui-subtitle-text--secondary)')).toBeNull());
    expect(container.querySelector('.kui-subtitle-text--secondary')?.textContent).toBe('Merhaba');
  });

  it('remembers both languages when persistence is on', async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
    render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} persist={{ storage }} />);
    await pick(user, /Subtitles/, 'English');
    await pick(user, /Subtitles/, 'Türkçe', 1);
    await waitFor(() => {
      const saved = [...store.values()].map((v) => JSON.parse(v) as Record<string, unknown>);
      expect(saved.some((p) => p.subtitleLanguage === 'en' && p.subtitleSecondaryLanguage === 'tr')).toBe(true);
    });
  });

  it('offers a second language only once a first is chosen, never the same track twice', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    expect(screen.queryByText('Second language')).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    expect(screen.getByText('Second language')).toBeInTheDocument();
    // English is the primary, so only Türkçe is offered below the heading.
    expect(screen.getAllByRole('menuitemradio', { name: 'English' })).toHaveLength(1);
  });
});

describe('audio description', () => {
  const audioTracks = [
    { label: 'English', language: 'en' },
    { label: 'English AD', language: 'en', kind: 'description' as const },
  ];

  async function openSettings(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('menu');
  }

  it('has no switch when the stream offers no description track', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} audioTracks={[audioTracks[0]!, { label: 'Türkçe', language: 'tr' }]} />);
    await openSettings(user);
    expect(screen.queryByRole('menuitemcheckbox', { name: /Audio description/ })).not.toBeInTheDocument();
  });

  it('switches to the description track and back to the main one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VideoPlayer src={SRC} enableCast={false} audioTracks={audioTracks} onAudioTrackChange={onChange} />);
    await openSettings(user);
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Audio description/ }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    await openSettings(user);
    expect(screen.getByRole('menuitemcheckbox', { name: /Audio description/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Audio description/ }));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('starts on description when asked to', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} audioTracks={audioTracks} audioDescription onAudioTrackChange={onChange} />,
    );
    await waitFor(() => expect(container.querySelector('.kui-player')).toBeInTheDocument());
    const user = userEvent.setup();
    await openSettings(user);
    await waitFor(() =>
      expect(screen.getByRole('menuitemcheckbox', { name: /Audio description/ })).toHaveAttribute('aria-checked', 'true'));
  });

  it('picking a plain track by hand turns the switch off', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} audioTracks={audioTracks} audioDescription />);
    await openSettings(user);
    await user.click(screen.getByRole('menuitem', { name: /Audio Language/i }));
    await user.click((await screen.findAllByRole('menuitemradio'))[0]!);
    await openSettings(user);
    expect(screen.getByRole('menuitemcheckbox', { name: /Audio description/ })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('sign language video', () => {
  it('renders a muted, labelled second video and keeps it on the main timeline', async () => {
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} signLanguage={{ src: 'https://example.com/sign.mp4' }} />,
    );
    const main = container.querySelector('video:not(.kui-sign-video)') as HTMLVideoElement;
    emit(main, 'loadedmetadata', { duration: 60 });
    const sign = await waitFor(() => {
      const el = container.querySelector('.kui-sign-video') as HTMLVideoElement | null;
      expect(el).not.toBeNull();
      return el!;
    }, { timeout: 4000 });
    expect(sign).toHaveAttribute('src', 'https://example.com/sign.mp4');
    expect(sign.muted).toBe(true);
    expect(sign).toHaveAttribute('aria-label', 'Sign language video');

    emit(main, 'timeupdate', { currentTime: 42 });
    await waitFor(() => expect(sign.currentTime).toBe(42));
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} signLanguage={{ src: 'https://example.com/sign.mp4' }} />,
    );
    await waitFor(() => expect(container.querySelector('.kui-sign')).not.toBeNull(), { timeout: 4000 });
    await user.click(container.querySelector('.kui-sign-close') as HTMLElement);
    expect(container.querySelector('.kui-sign')).toBeNull();
  });
});

describe('document picture-in-picture', () => {
  type FakePipWindow = EventTarget & { document: Document; closed: boolean; close(): void };
  let pipWindow: FakePipWindow;
  let requestWindow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const target = new EventTarget();
    pipWindow = Object.assign(target, {
      document: document.implementation.createHTMLDocument('pip'),
      closed: false,
      close() { this.closed = true; target.dispatchEvent(new Event('pagehide')); },
    }) as FakePipWindow;
    requestWindow = vi.fn(async () => pipWindow);
    (window as unknown as { documentPictureInPicture: unknown }).documentPictureInPicture = { requestWindow, window: null };
  });
  afterEach(() => { delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture; });

  it('moves the player (same video node) into the PiP window and back when it closes', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} documentPictureInPicture />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const player = container.querySelector('.kui-player') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Picture-in-Picture' }));
    await waitFor(() => expect(pipWindow.document.body.contains(player)).toBe(true));
    expect(requestWindow).toHaveBeenCalledWith(expect.objectContaining({ width: expect.any(Number) }));
    expect(player.querySelector('video')).toBe(video);                       // not re-created: playback continues
    expect(container.querySelector('.kui-pip-placeholder')).toHaveTextContent('Playing in picture-in-picture');

    act(() => { pipWindow.dispatchEvent(new Event('pagehide')); });
    await waitFor(() => expect(container.contains(player)).toBe(true));
    expect(container.querySelector('.kui-pip-placeholder')).toBeNull();
  });

  it('closing from the player button closes the window', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} documentPictureInPicture />);
    const player = container.querySelector('.kui-player') as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Picture-in-Picture' }));
    await waitFor(() => expect(pipWindow.document.body.contains(player)).toBe(true));
    // The PiP document has no window of its own to drive user-event with; a plain click event does the job.
    const exit = pipWindow.document.body.querySelector('[aria-label="Exit Picture-in-Picture"]')!;
    act(() => { exit.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await waitFor(() => expect(pipWindow.closed).toBe(true));
    await waitFor(() => expect(container.contains(player)).toBe(true));
  });

  it('stays in the page when the browser refuses the window', async () => {
    requestWindow.mockRejectedValueOnce(new Error('NotAllowedError'));
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} documentPictureInPicture />);
    await user.click(screen.getByRole('button', { name: 'Picture-in-Picture' }));
    await waitFor(() => expect(requestWindow).toHaveBeenCalled());
    expect(container.querySelector('.kui-pip-placeholder')).toBeNull();
    expect(container.querySelector('.kui-player')).not.toBeNull();
  });

  it('unmounting while open puts the node back first, so React can remove it', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<VideoPlayer src={SRC} enableCast={false} documentPictureInPicture />);
    const player = container.querySelector('.kui-player') as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Picture-in-Picture' }));
    await waitFor(() => expect(pipWindow.document.body.contains(player)).toBe(true));
    expect(() => unmount()).not.toThrow();
  });

  it('is off unless asked for: the button uses the plain video PiP path', async () => {
    render(<VideoPlayer src={SRC} enableCast={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument());
    expect(requestWindow).not.toHaveBeenCalled();
  });
});

describe('on-device subtitle translation', () => {
  const subtitles = [{ label: 'English', srclang: 'en', src: '/en.srt' }];
  const files: Record<string, string> = { '/en.srt': '1\n00:00:01,000 --> 00:00:04,000\nHello there\n' };
  let fetched: string[];
  let fetchSpy: MockInstance<typeof fetch>;
  let translate: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetched = [];
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      fetched.push(url);
      return new Response(files[url] ?? '', { status: files[url] ? 200 : 404 });
    });
    translate = vi.fn(async (text: string) => `[tr] ${text}`);
    create = vi.fn(async (options: { monitor?: (m: EventTarget) => void }) => {
      const monitor = new EventTarget();
      options.monitor?.(monitor);
      monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: 0.4 }));
      return { translate, destroy: vi.fn() };
    });
    (globalThis as { Translator?: unknown }).Translator = {
      availability: vi.fn(async () => 'downloadable'),
      create,
    };
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    delete (globalThis as { Translator?: unknown }).Translator;
  });

  async function openSubtitles(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
  }

  it('offers a translation only once a track is chosen, labelled as automatic', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} translation={{ targets: ['tr'] }} />);
    await openSubtitles(user);
    expect(screen.queryByRole('menuitemradio', { name: /Translate to/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

    await openSubtitles(user);
    const option = await screen.findByRole('menuitemradio', { name: /Translate to/ });
    expect(option).toHaveTextContent('Turkish');
    expect(option).toHaveTextContent('Automatic translation');
    expect(option).toHaveTextContent('downloads a language model once');
  });

  it('translates the current cue on the device, with no request but the subtitle file', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} translation={{ targets: ['tr'] }} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 60 });
    await openSubtitles(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    await openSubtitles(user);
    await user.click(await screen.findByRole('menuitemradio', { name: /Translate to/ }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'tr' }));
    emit(video, 'timeupdate', { currentTime: 2 });
    await waitFor(() => expect(container.querySelector('.kui-subtitle-text--secondary')?.textContent).toBe('[tr] Hello there'));
    expect(translate).toHaveBeenCalledWith('Hello there');
    // Privacy: the only thing fetched is the subtitle file the page was pointed at.
    expect([...new Set(fetched)]).toEqual(['/en.srt']);
  });

  it('offers nothing where the browser has no Translator', async () => {
    delete (globalThis as { Translator?: unknown }).Translator;
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} translation={{ targets: ['tr'] }} />);
    await openSubtitles(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    await openSubtitles(user);
    expect(screen.queryByRole('menuitemradio', { name: /Translate to/ })).not.toBeInTheDocument();
  });

  it('is off unless asked for', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    await openSubtitles(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    await openSubtitles(user);
    expect(screen.queryByRole('menuitemradio', { name: /Translate to/ })).not.toBeInTheDocument();
  });
});

describe('frame tools and A-B loop', () => {
  const tick = (video: HTMLVideoElement, t: number) => act(() => { emit(video, 'timeupdate', { currentTime: t }); });
  async function setup(props: Partial<React.ComponentProps<typeof VideoPlayer>> = {}) {
    const user = userEvent.setup();
    const utils = render(<VideoPlayer src={SRC} enableCast={false} frameTools={{ fps: 25 }} {...props} />);
    const video = utils.container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 120 });
    await screen.findByRole('group', { name: 'Frame tools' }, { timeout: 4000 });
    return { user, video, ...utils };
  }


  it('is off unless asked for', async () => {
    render(<VideoPlayer src={SRC} enableCast={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument());
    expect(screen.queryByRole('group', { name: 'Frame tools' })).not.toBeInTheDocument();
  });

  it('shows the SMPTE timecode and frame number of the playhead', async () => {
    const { video } = await setup();
    tick(video, 61.52);
    await waitFor(() => expect(screen.getByLabelText('Go to frame or timecode')).toHaveValue('00:01:01:13'));
    expect(screen.getByRole('textbox', { name: 'Frame number' })).toHaveValue('1538');
  });

  it('goes to a frame number or a timecode', async () => {
    const { user, video } = await setup();
    const input = screen.getByLabelText('Go to frame or timecode');
    await user.clear(input);
    await user.type(input, '50{Enter}');
    expect(video.currentTime).toBeCloseTo(2.02);
    await user.clear(input);
    await user.type(input, '00:00:10:00{Enter}');
    expect(video.currentTime).toBe(10);
    await user.clear(input);
    await user.type(input, 'garbage{Enter}');
    expect(video.currentTime).toBe(10);   // unchanged
  });

  it('has a frame-number box next to the timecode that seeks to that frame', async () => {
    const { user, video } = await setup();
    const box = screen.getByRole('textbox', { name: 'Frame number' });
    await user.clear(box);
    await user.type(box, '100{Enter}');
    expect(video.currentTime).toBeCloseTo(4.02);
    await user.clear(box);
    await user.type(box, 'abc{Enter}');
    expect(video.currentTime).toBeCloseTo(4.02);   // not a frame number: unchanged
    expect(screen.getByText(/Enter a frame number/)).toBeInTheDocument();   // and announced
    await waitFor(() => expect(box).toHaveValue('100'));
  });

  it('steps exactly one frame at the configured rate', async () => {
    const { user, video, container } = await setup();
    tick(video, 10.02);   // inside frame 250
    (container.querySelector('.kui-player') as HTMLElement).focus();
    await user.keyboard('.');
    expect(video.currentTime).toBeCloseTo(251.5 / 25);
    await user.keyboard(',');
    await user.keyboard(',');
    expect(video.currentTime).toBeCloseTo(249.5 / 25);
  });

  it('loops A to B, forever by default, and marks the range on the seek bar', async () => {
    const { user, video, container } = await setup();
    tick(video, 10);
    await user.click(screen.getByRole('button', { name: 'Set loop start (A)' }));
    tick(video, 20);
    await user.click(screen.getByRole('button', { name: 'Set loop end (B)' }));
    expect(screen.getByRole('button', { name: 'Clear loop' })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.kui-loop-range')).not.toBeNull());

    tick(video, 20.05);
    expect(video.currentTime).toBe(10);
    tick(video, 20.05);
    expect(video.currentTime).toBe(10);
  });

  it('stops looping after the chosen number of passes', async () => {
    const { user, video } = await setup();
    tick(video, 10);
    await user.click(screen.getByRole('button', { name: 'Set loop start (A)' }));
    tick(video, 20);
    await user.click(screen.getByRole('button', { name: 'Set loop end (B)' }));
    await user.selectOptions(screen.getByLabelText('Repeat'), '2');

    tick(video, 20.05);
    expect(video.currentTime).toBe(10);        // pass 1 → back to A
    video.currentTime = 20.05;
    tick(video, 20.05);
    expect(video.currentTime).toBe(20.05);     // pass 2 is the last: plays on
  });

  it('clears with the third press, and the `a` key does the same job', async () => {
    const { user, video, container } = await setup();
    (container.querySelector('.kui-player') as HTMLElement).focus();
    tick(video, 5);
    await user.keyboard('a');
    expect(screen.getByRole('button', { name: 'Set loop end (B)' })).toBeInTheDocument();
    tick(video, 9);
    await user.keyboard('a');
    expect(screen.getByRole('button', { name: 'Clear loop' })).toBeInTheDocument();
    await user.keyboard('a');
    expect(screen.getByRole('button', { name: 'Set loop start (A)' })).toBeInTheDocument();
  });

  it('remembers the playback speed chosen for a range', async () => {
    const { user, video } = await setup();
    const speed = (v: number) => act(() => { video.playbackRate = v; emit(video, 'ratechange'); });
    tick(video, 10);
    await user.click(screen.getByRole('button', { name: 'Set loop start (A)' }));
    tick(video, 20);
    await user.click(screen.getByRole('button', { name: 'Set loop end (B)' }));
    speed(0.5);                                   // slow down while practising this phrase
    await user.click(screen.getByRole('button', { name: 'Clear loop' }));
    speed(1);

    tick(video, 10);
    await user.click(screen.getByRole('button', { name: 'Set loop start (A)' }));
    tick(video, 20);
    await user.click(screen.getByRole('button', { name: 'Set loop end (B)' }));   // the same range again
    await waitFor(() => expect(video.playbackRate).toBe(0.5));
  });
});

describe('subtitle delay', () => {
  const tick = (video: HTMLVideoElement, t: number) => act(() => { emit(video, 'timeupdate', { currentTime: t }); });
  const subtitles = [{ label: 'English', srclang: 'en', src: '/en.srt' }];
  let fetchSpy: MockInstance<typeof fetch>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('1\n00:00:01,000 --> 00:00:04,000\nHello there\n', { status: 200 }));
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  const primaryText = (c: HTMLElement) => c.querySelector('.kui-subtitle-text:not(.kui-subtitle-text--secondary)')?.textContent ?? null;

  it('shifts cues later with h and earlier with g, and shows the delay', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 60 });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    (container.querySelector('.kui-player') as HTMLElement).focus();

    tick(video, 4.5);
    await waitFor(() => expect(primaryText(container)).toBeNull());       // cue ended at 4 s

    for (let i = 0; i < 10; i += 1) await user.keyboard('h');             // +1.0 s
    expect(await screen.findByText('Subtitle delay: +1 s')).toBeInTheDocument();
    tick(video, 4.5);
    await waitFor(() => expect(primaryText(container)).toBe('Hello there'));   // now runs 2–5 s
    tick(video, 1.5);
    await waitFor(() => expect(primaryText(container)).toBeNull());       // not yet at 1.5 s

    for (let i = 0; i < 20; i += 1) await user.keyboard('g');             // −1.0 s
    tick(video, 0.5);
    await waitFor(() => expect(primaryText(container)).toBe('Hello there'));   // runs 0–3 s
  });

  it('does nothing while no subtitle is selected', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    (container.querySelector('.kui-player') as HTMLElement).focus();
    await user.keyboard('h');
    expect(screen.queryByText(/Subtitle delay/)).not.toBeInTheDocument();
  });

  it('can be reset from the subtitles menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} subtitles={subtitles} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    (container.querySelector('.kui-player') as HTMLElement).focus();
    await user.keyboard('hhh');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Reset subtitle delay (+0.3 s)' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.keyboard('h');
    expect(await screen.findByText('Subtitle delay: +0.1 s')).toBeInTheDocument();
  });
});

describe('subtitle search and dropped files', () => {
  const SRT = '1\n00:00:05,000 --> 00:00:08,000\nWhere is the key?\n\n2\n00:01:10,000 --> 00:01:12,000\nThe key is here.\n\n3\n00:02:00,000 --> 00:02:02,000\nGoodbye\n';
  let fetchSpy: MockInstance<typeof fetch>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(SRT, { status: 200 }));
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('finds a line by its text and seeks to it (including the delay)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} subtitles={[{ label: 'English', srclang: 'en', src: '/en.srt' }]} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 300 });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    expect(screen.queryByRole('menuitemradio', { name: 'Search subtitles' })).not.toBeInTheDocument();   // nothing chosen yet
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    (container.querySelector('.kui-player') as HTMLElement).focus();
    await user.keyboard('hhhhh');   // +0.5 s

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Search subtitles' }));

    const dialog = await screen.findByRole('dialog', { name: 'Search subtitles' });
    await user.type(within(dialog).getByRole('searchbox'), 'KEY');
    const hits = await within(dialog).findAllByRole('button', { name: /key/i });
    expect(hits).toHaveLength(2);
    await user.click(hits[1]!);
    expect(video.currentTime).toBeCloseTo(70.5);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} subtitles={[{ label: 'English', srclang: 'en', src: '/en.srt' }]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    void container;
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Search subtitles' }));
    const dialog = await screen.findByRole('dialog', { name: 'Search subtitles' });
    await user.type(within(dialog).getByRole('searchbox'), 'zzzz');
    expect(await within(dialog).findByText('No matches')).toBeInTheDocument();
  });

  it('adds a subtitle file dropped on the player, selects it, and shows its lines', async () => {
    const created: string[] = [];
    URL.createObjectURL = vi.fn(() => { const url = `blob:test/${created.length}`; created.push(url); return url; });
    URL.revokeObjectURL = vi.fn();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 300 });
    const file = new File([SRT], 'movie.tr.srt', { type: '' });
    Object.defineProperty(file, 'text', { value: async () => SRT });

    const player = container.querySelector('.kui-player') as HTMLElement;
    act(() => { fireEvent.dragOver(player, { dataTransfer: { types: ['Files'], files: [file] } }); });
    expect(player).toHaveClass('is-dropping');
    await act(async () => { fireEvent.drop(player, { dataTransfer: { types: ['Files'], files: [file] } }); });

    await waitFor(() => expect(created).toHaveLength(1));
    expect(player).not.toHaveClass('is-dropping');
    act(() => { emit(video, 'timeupdate', { currentTime: 6 }); });
    await waitFor(() => expect(container.querySelector('.kui-subtitle-text')?.textContent).toBe('Where is the key?'));
  });

  it('leaves files that are not subtitles to the page', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} />);
    const player = container.querySelector('.kui-player') as HTMLElement;
    const image = new File(['x'], 'cat.png');
    const prevented = !fireEvent.drop(player, { dataTransfer: { types: ['Files'], files: [image] } });
    expect(prevented).toBe(false);   // not default-prevented: the browser/page may handle it
  });
});

describe('audio layout and waveform', () => {
  const POSTER = 'https://example.com/cover.jpg';
  const TRANSCRIPT = '1\n00:00:02,000 --> 00:00:05,000\nWelcome to the show.\n\n2\n00:00:06,000 --> 00:00:09,000\nToday: waveforms.\n';
  let fetchSpy: MockInstance<typeof fetch>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/peaks.json') return new Response(JSON.stringify({ bits: 8, data: [-10, 20, -128, 64, -5, 5] }), { status: 200 });
      if (url === '/en.srt') return new Response(TRANSCRIPT, { status: 200 });
      return new Response('', { status: 404 });
    });
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('shows artwork, keeps the controls up, and hides the video without stopping it', async () => {
    const { container } = render(<VideoPlayer src="/episode.mp3" poster={POSTER} audioOnly enableCast={false} />);
    await waitFor(() => expect(container.querySelector('.kui-player--audio')).not.toBeNull());
    expect(container.querySelector('.kui-artwork')).toHaveAttribute('src', POSTER);
    expect(container.querySelector('.kui-chrome')).not.toHaveClass('is-hidden');
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('draws a waveform from a peaks array, and keeps the seek slider', async () => {
    const { container } = render(
      <VideoPlayer src="/episode.mp3" audioOnly waveform={[0.1, 0.8, 0.4, 1]} enableCast={false} />,
    );
    await waitFor(() => expect(container.querySelectorAll('.kui-wave')).toHaveLength(2));
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument();   // still the accessible control
  });

  it('draws it from a peaks file by URL', async () => {
    const { container } = render(<VideoPlayer src="/episode.mp3" audioOnly waveform="/peaks.json" enableCast={false} />);
    await waitFor(() => expect(container.querySelectorAll('.kui-wave')).toHaveLength(2), { timeout: 4000 });
    expect(container.querySelector('.kui-wave--base path')?.getAttribute('d')).toBeTruthy();
  });

  it('falls back to a plain bar when the peaks cannot be loaded', async () => {
    const { container } = render(<VideoPlayer src="/episode.mp3" audioOnly waveform="/missing.json" enableCast={false} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/missing.json', expect.anything()), { timeout: 4000 });
    expect(container.querySelector('.kui-wave')).toBeNull();
  });

  it('computes the waveform from the audio itself with "decode"', async () => {
    const decodeAudioData = vi.fn(async () => ({
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([0.1, 0.5, 0.2, 1, 0.3, 0.2, 0.1, 0.9]),
    }));
    const close = vi.fn(async () => {});
    (globalThis as { AudioContext?: unknown }).AudioContext = class { decodeAudioData = decodeAudioData; close = close; };
    fetchSpy.mockImplementation(async () => new Response(new ArrayBuffer(8), { status: 200 }));
    try {
      const { container } = render(<VideoPlayer src="/episode.mp3" audioOnly waveform="decode" enableCast={false} />);
      await waitFor(() => expect(container.querySelectorAll('.kui-wave')).toHaveLength(2), { timeout: 4000 });
      expect(decodeAudioData).toHaveBeenCalled();
      expect(close).toHaveBeenCalled();
    } finally {
      delete (globalThis as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('opens a transcript, marks the line being spoken, and seeks on click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VideoPlayer src="/episode.mp3" audioOnly poster={POSTER} enableCast={false}
        subtitles={[{ label: 'English', srclang: 'en', src: '/en.srt' }]} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 120 });
    await user.click(await screen.findByRole('button', { name: 'Transcript' }));
    expect(await screen.findByText('Welcome to the show.')).toBeInTheDocument();
    expect(container.querySelector('.kui-artwork')).toBeNull();            // the transcript takes the artwork's place

    act(() => { emit(video, 'timeupdate', { currentTime: 7 }); });
    await waitFor(() => expect(screen.getByText('Today: waveforms.').closest('li')).toHaveAttribute('aria-current', 'true'));

    await user.click(screen.getByText('Welcome to the show.'));
    expect(video.currentTime).toBe(2);
  });

  it('is an ordinary player unless asked', async () => {
    const { container } = render(<VideoPlayer src="/episode.mp3" poster={POSTER} enableCast={false} />);
    await waitFor(() => expect(container.querySelector('.kui-player')).not.toBeNull());
    expect(container.querySelector('.kui-artwork')).toBeNull();
    expect(container.querySelector('.kui-player--audio')).toBeNull();
  });
});

describe('offline viewing', () => {
  const FILE = 'https://example.com/lecture.mp4';
  let entries: Map<string, Response>;
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);                         // jsdom's Blob cannot back a Response
    entries = new Map();
    const cache = {
      match: async (r: string | Request) => entries.get(typeof r === 'string' ? r : r.url)?.clone(),
      put: async (r: string | Request, res: Response) => { entries.set(typeof r === 'string' ? r : r.url, res); },
      delete: async (r: string | Request) => entries.delete(typeof r === 'string' ? r : r.url),
      keys: async () => [...entries.keys()].map((u) => new Request(u)),
    };
    vi.stubGlobal('caches', { open: async () => cache, delete: async () => true });
    URL.createObjectURL = vi.fn(() => 'blob:offline-copy');
    URL.revokeObjectURL = vi.fn();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
      new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1024)); c.close(); } }),
      { status: 200, headers: { 'content-length': '1024', 'content-type': 'video/mp4' } },
    ));
  });
  afterEach(() => { fetchSpy.mockRestore(); vi.unstubAllGlobals(); });

  async function openMenu(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('menu');
  }

  it('downloads the file, then plays the saved copy next time', async () => {
    const user = userEvent.setup();
    const first = render(<VideoPlayer src={FILE} enableCast={false} offline />);
    await openMenu(user);
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Offline viewing/ }, { timeout: 4000 }));
    await waitFor(() => expect(entries.has(FILE)).toBe(true));

    await openMenu(user);
    const row = await screen.findByRole('menuitemcheckbox', { name: /Offline viewing/ });
    expect(row).toHaveAttribute('aria-checked', 'true');
    expect(row).toHaveTextContent('Downloaded · 1 kB');
    // Mid-playback the source is deliberately left alone: swapping it would reload the video.
    expect(first.container.querySelector('source')).toHaveAttribute('src', FILE);
    first.unmount();

    // A fresh mount (page reload): the network URL is never used for playback.
    const second = render(<VideoPlayer src={FILE} enableCast={false} offline />);
    await waitFor(() => expect(second.container.querySelector('source')).toHaveAttribute('src', 'blob:offline-copy'), { timeout: 4000 });
  });

  it('removes the copy and goes back to the network source', async () => {
    const user = userEvent.setup();
    entries.set(FILE, new Response(new Uint8Array(2048), { headers: { 'content-type': 'video/mp4' } }));
    const { container } = render(<VideoPlayer src={FILE} enableCast={false} offline />);
    await waitFor(() => expect(container.querySelector('source')).toHaveAttribute('src', 'blob:offline-copy'), { timeout: 4000 });
    await openMenu(user);
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Offline viewing/ }));
    await waitFor(() => expect(entries.has(FILE)).toBe(false));
    await waitFor(() => expect(container.querySelector('source')).toHaveAttribute('src', FILE));
  });

  it('reports a failed download and lets the viewer retry', async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementationOnce(async () => new Response('', { status: 500 }));
    render(<VideoPlayer src={FILE} enableCast={false} offline />);
    await openMenu(user);
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Offline viewing/ }, { timeout: 4000 }));
    await openMenu(user);
    expect(await screen.findByRole('menuitemcheckbox', { name: /Offline viewing/ })).toHaveTextContent('Failed — retry');
  });

  it('is not offered for streams, without storage, or unless asked for', async () => {
    const user = userEvent.setup();
    const a = render(<VideoPlayer src="https://example.com/live.m3u8" enableCast={false} offline />);
    await openMenu(user);
    expect(screen.queryByRole('menuitemcheckbox', { name: /Offline viewing/ })).not.toBeInTheDocument();
    a.unmount();

    const b = render(<VideoPlayer src={FILE} enableCast={false} />);
    await openMenu(user);
    expect(screen.queryByRole('menuitemcheckbox', { name: /Offline viewing/ })).not.toBeInTheDocument();
    b.unmount();

    vi.stubGlobal('caches', undefined);
    render(<VideoPlayer src={FILE} enableCast={false} offline />);
    await openMenu(user);
    expect(screen.queryByRole('menuitemcheckbox', { name: /Offline viewing/ })).not.toBeInTheDocument();
  });
});

describe('subtitle editor', () => {
  const SRT = '1\n00:00:01,000 --> 00:00:03,000\nHello there\n\n2\n00:00:05,000 --> 00:00:07,000\nSecond line\n';
  let fetchSpy: MockInstance<typeof fetch>;
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);   // jsdom's Blob has no text()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(SRT, { status: 200 }));
    URL.createObjectURL = vi.fn(() => 'blob:edited');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { fetchSpy.mockRestore(); vi.unstubAllGlobals(); });

  async function openEditor(user: ReturnType<typeof userEvent.setup>) {
    const utils = render(<VideoPlayer src={SRC} enableCast={false} subtitles={[{ label: 'English', srclang: 'en', src: '/en.srt' }]} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Edit subtitles' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit subtitles/ });
    await within(dialog).findAllByLabelText('Text');
    return { ...utils, dialog };
  }

  it('lists the lines, and applying edits makes a new selected track with the changes', async () => {
    const user = userEvent.setup();
    const { container, dialog } = await openEditor(user);
    const texts = within(dialog).getAllByLabelText('Text') as HTMLTextAreaElement[];
    expect(texts.map((t) => t.value)).toEqual(['Hello there', 'Second line']);

    await user.clear(texts[0]!);
    await user.type(texts[0]!, 'Hi!');
    const starts = within(dialog).getAllByLabelText('Start');
    await user.clear(starts[0]!);
    await user.type(starts[0]!, '2');                       // now 2–3 s instead of 1–3 s
    await user.click(within(dialog).getByRole('button', { name: 'Use these edits' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // The edit was written out as WebVTT with the new text and the new start time…
    const made = (URL.createObjectURL as unknown as { mock: { calls: [Blob][] } }).mock.calls.at(-1)![0];
    const vtt = await made.text();
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:02.000 --> 00:00:03.000\nHi!');
    expect(vtt).toContain('Second line');
    // …and became a track of its own, selected, with the original still there to go back to.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('menuitem', { name: /Subtitles/ }));
    expect(screen.getByRole('menuitemradio', { name: 'English ✎' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('menuitemradio', { name: 'English' }).length).toBeGreaterThan(0);
    void container;
  });

  it('refuses nonsense times instead of guessing, and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const { dialog } = await openEditor(user);
    const ends = within(dialog).getAllByLabelText('End');
    await user.clear(ends[1]!);
    await user.type(ends[1]!, 'soon');
    await user.click(within(dialog).getByRole('button', { name: 'Use these edits' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Check the highlighted times');
    expect(ends[1]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('deletes a line, adds one at the playhead, and saves SRT or WebVTT', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { dialog } = await openEditor(user);
    await user.click(within(dialog).getAllByRole('button', { name: 'Delete line' })[0]!);
    expect(within(dialog).getAllByLabelText('Text')).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Add a line at the playhead' }));
    expect(within(dialog).getAllByLabelText('Text')).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: 'Download SRT' }));
    expect(click).toHaveBeenCalledTimes(1);
    const srt = await ((URL.createObjectURL as unknown as { mock: { calls: [Blob][] } }).mock.calls.at(-1)![0]).text();
    expect(srt).toContain('Second line');
    expect(srt).not.toContain('Hello there');          // the deleted line is gone
    click.mockRestore();
  });
});

describe('study mode', () => {
  const mem = () => {
    const map = new Map<string, string>();
    return { map, storage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); },
    } };
  };
  const play = (video: HTMLVideoElement, from: number, to: number) => {
    for (let t = from; t < to; t += 1) {
      act(() => { emit(video, 'play', { paused: false }); emit(video, 'timeupdate', { currentTime: t + 1 }); });
    }
  };

  it('is off unless asked for', async () => {
    render(<VideoPlayer src={SRC} enableCast={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Notes/ })).not.toBeInTheDocument();
  });

  it('tracks what was actually watched and reports it', async () => {
    const onProgress = vi.fn();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} learning={{ onProgress }} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    const toggle = await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 });
    expect(toggle).toHaveTextContent('0% watched');

    play(video, 0, 40);                                   // watched the first 40 s
    act(() => { emit(video, 'timeupdate', { currentTime: 95 }); });   // …then skipped to the end
    await waitFor(() => expect(toggle).toHaveTextContent('40% watched'));
    expect(onProgress).toHaveBeenLastCalledWith(40);
  });

  it('keeps notes with the time they were started at, seeks on click, and exports Markdown', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:notes');
    URL.revokeObjectURL = vi.fn();
    const { container } = render(<VideoPlayer src={SRC} title="Cell biology" enableCast={false} learning />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 600 });
    act(() => { emit(video, 'timeupdate', { currentTime: 125 }); });
    await user.click(await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 }));
    const dialog = await screen.findByRole('dialog', { name: 'Notes' });

    const input = within(dialog).getByRole('textbox');
    await user.type(input, 'ATP is the unit of energy');
    act(() => { emit(video, 'timeupdate', { currentTime: 200 }); });         // typing took a while
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('2:05')).toBeInTheDocument();          // stamped when typing began, not at 3:20
    expect(within(dialog).getByText(/Notes are kept only until you leave/)).toBeInTheDocument();   // no persist → says so

    await user.click(within(dialog).getByRole('button', { name: 'Export Markdown' }));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();

    await user.click(within(dialog).getByText('ATP is the unit of energy'));
    expect(video.currentTime).toBe(125);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('remembers notes and progress across visits with persist, per source', async () => {
    const { map, storage } = mem();
    const user = userEvent.setup();
    const first = render(<VideoPlayer src={SRC} enableCast={false} learning persist={{ storage }} />);
    await user.click(await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 }));
    await user.type(within(await screen.findByRole('dialog')).getByRole('textbox'), 'remember me');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect([...map.keys()].some((k) => k.includes(':notes:'))).toBe(true);
    first.unmount();

    render(<VideoPlayer src={SRC} enableCast={false} learning persist={{ storage }} />);
    await user.click(await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('remember me')).toBeInTheDocument();
    expect(within(dialog).queryByText(/kept only until/)).not.toBeInTheDocument();
  });

  it('draws the watched map on the seek bar only in learning mode', async () => {
    const off = render(<VideoPlayer src={SRC} enableCast={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument());
    expect(off.container.querySelector('.kui-seek-watched')).toBeNull();
    off.unmount();

    const { container } = render(<VideoPlayer src={SRC} enableCast={false} learning />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 });
    expect(container.querySelector('.kui-seek-watched')).toBeNull();   // nothing watched yet
    play(video, 0, 40);
    await waitFor(() => expect(container.querySelectorAll('.kui-seek-watched .kui-watched-run')).toHaveLength(1));
    const run = container.querySelector('.kui-seek-watched .kui-watched-run') as HTMLElement;
    expect(run.style.width).toBe('40%');
    expect(container.querySelector('.kui-seek-watched')).toHaveAttribute('aria-hidden', 'true');
  });

  it('clears the seek-bar map when the source changes, and restores it when switching back', async () => {
    const { map, storage } = mem();
    const other = 'https://example.com/other.mp4';
    const { container, rerender } = render(<VideoPlayer src={SRC} enableCast={false} learning persist={{ storage }} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 });
    play(video, 0, 40);
    await waitFor(() => expect(container.querySelectorAll('.kui-seek-watched .kui-watched-run')).toHaveLength(1));
    expect([...map.keys()].some((k) => k.includes(':watched:'))).toBe(true);

    rerender(<VideoPlayer src={other} enableCast={false} learning persist={{ storage }} />);
    await waitFor(() => expect(container.querySelector('.kui-seek-watched')).toBeNull());

    rerender(<VideoPlayer src={SRC} enableCast={false} learning persist={{ storage }} />);
    await waitFor(() => expect(container.querySelectorAll('.kui-seek-watched .kui-watched-run')).toHaveLength(1));
  });

  it('draws a saved watched map on mount, and leaves nothing behind on unmount', async () => {
    const { storage } = mem();
    const first = render(<VideoPlayer src={SRC} enableCast={false} learning persist={{ storage }} />);
    const video = first.container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 100 });
    await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 });
    play(video, 0, 40);
    await waitFor(() => expect(first.container.querySelectorAll('.kui-seek-watched .kui-watched-run')).toHaveLength(1));
    first.unmount();

    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const second = render(<VideoPlayer src={SRC} enableCast={false} learning persist={{ storage }} />);
    await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 });
    await waitFor(() => expect(second.container.querySelectorAll('.kui-seek-watched .kui-watched-run')).toHaveLength(1));
    expect((second.container.querySelector('.kui-seek-watched .kui-watched-run') as HTMLElement).style.width).toBe('40%');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('while rendering a different component'))).toBe(false);
    warn.mockRestore();
    second.unmount();

    const third = render(<VideoPlayer src="https://example.com/fresh.mp4" enableCast={false} learning />);
    await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 });
    expect(third.container.querySelector('.kui-seek-watched')).toBeNull();
  });

  it('deletes a note', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer src={SRC} enableCast={false} learning />);
    await user.click(await screen.findByRole('button', { name: /Notes/ }, { timeout: 4000 }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'temp');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    expect(within(dialog).queryByText('temp')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/No notes yet/)).toBeInTheDocument();
  });
});
