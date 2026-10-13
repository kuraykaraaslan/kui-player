import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayerFacade } from '../../react/facade';

const SRC = 'https://example.com/video.mp4';

describe('VideoPlayerFacade', () => {
  it('renders only a poster and a real, named play button — no <video>, no player chrome', () => {
    const { container } = render(
      <VideoPlayerFacade src={SRC} poster="https://example.com/p.jpg" title="Big Buck Bunny" />,
    );
    expect(screen.getByRole('button', { name: 'Play Big Buck Bunny' }).tagName).toBe('BUTTON');
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.kui-player')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/p.jpg');
  });

  it('reserves the final box up front, so loading does not shift the layout', () => {
    const { container } = render(<VideoPlayerFacade src={SRC} aspectRatio="4 / 3" />);
    expect((container.firstElementChild as HTMLElement).style.aspectRatio).toBe('4 / 3');
  });

  it('loads the player on click and starts it (autoPlay)', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayerFacade src={SRC} title="T" enableCast={false} />);
    await user.click(screen.getByRole('button', { name: 'Play T' }));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull(), { timeout: 4000 });
    expect(container.querySelector('video')).toHaveAttribute('autoplay');
    expect(screen.queryByRole('button', { name: 'Play T' })).not.toBeInTheDocument();
  });

  it('opens with the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoPlayerFacade src={SRC} enableCast={false} />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull(), { timeout: 4000 });
  });
});
