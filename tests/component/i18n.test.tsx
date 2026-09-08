import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../../react';
import { tr } from '../../react/i18n/locales/tr';
import { ar } from '../../react/i18n/locales/ar';
import { emit } from '../setup';

const SRC = 'https://example.com/video.mp4';

describe('localisation', () => {
  it('translates visible text and the labels only a screen reader hears', async () => {
    render(<VideoPlayer src={SRC} enableCast={false} locale={tr} qualities={[{ label: '720p', value: '720' }]} />);

    expect(screen.getByRole('button', { name: 'Oynat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sesi kapat' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Konum' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tam ekran' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ayarlar' }));
    expect(await screen.findByRole('menuitem', { name: /Kalite/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Oynatma hızı/ })).toBeInTheDocument();
  });

  it('translates error text by error name', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} locale={tr} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'error', { error: { code: 4 } as MediaError });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bu video kullanılamıyor');
    expect(alert).toHaveTextContent('Tekrar dene');
  });

  it('announces state changes in the active language', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} locale={tr} />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Oynat' }));
    await waitFor(() => expect(live).toHaveTextContent('Oynatılıyor'));
  });

  it('falls back to English for anything a partial dictionary omits', () => {
    render(<VideoPlayer src={SRC} enableCast={false} locale={{ play: 'Spielen' }} />);
    expect(screen.getByRole('button', { name: 'Spielen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('mirrors the layout for a right-to-left locale', () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} locale={ar} />);
    const player = container.querySelector('.kui-player') as HTMLElement;
    expect(player).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'تشغيل' })).toBeInTheDocument();
  });

  it('renders durations in the locale\'s numbering system', async () => {
    // CLDR gives the bare `ar` locale Western digits; `ar-EG` is the one that
    // asks for Arabic-Indic, which is what makes this worth testing.
    const { container } = render(
      <VideoPlayer src={SRC} enableCast={false} locale={{ ...ar, locale: 'ar-EG' }} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 125 });
    emit(video, 'timeupdate', { currentTime: 65 });

    await waitFor(() => {
      expect(container.querySelector('.kui-time')?.textContent).toMatch(/[٠-٩]/);
    });
  });

  it('keeps Western digits where the locale asks for them', async () => {
    const { container } = render(<VideoPlayer src={SRC} enableCast={false} locale={tr} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 125 });
    emit(video, 'timeupdate', { currentTime: 65 });
    await waitFor(() => {
      expect(container.querySelector('.kui-time')).toHaveTextContent('1:05/2:05');
    });
  });
});
