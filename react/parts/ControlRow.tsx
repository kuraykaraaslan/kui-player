import { useState } from 'react';
import { cn } from '../../libs/utils/cn.js';
import { Icon, type IconName } from '../icons/index.js';
import { CtrlBtn } from './CtrlBtn.js';
import { formatTime } from '../../modules/videoplayer/videoplayer.format.js';
import type { CastState } from '../../modules/videoplayer/videoplayer.types.js';

type ControlRowProps = {
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  showSettings: boolean;
  enableCast: boolean;
  castState: CastState;
  /** Hidden entirely when the browser has no Picture-in-Picture. */
  showPip: boolean;
  isPip: boolean;
  onTogglePip: () => void;
  onPlay: () => void;
  onSeekBy: (delta: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (val: number) => void;
  onToggleSettings: () => void;
  onToggleCast: () => void;
  onToggleFullscreen: () => void;
};

export function ControlRow({
  playing, muted, volume, currentTime, duration, isFullscreen, showSettings,
  enableCast, castState, showPip, isPip, onTogglePip,
  onPlay, onSeekBy, onToggleMute, onVolumeChange,
  onToggleSettings, onToggleCast, onToggleFullscreen,
}: ControlRowProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeIcon: IconName = muted || volume === 0 ? 'volumeOff' : volume < 0.5 ? 'volumeLow' : 'volumeHigh';

  return (
    <div className="kui-row">
      <CtrlBtn onClick={() => onSeekBy(-10)} aria-label="Rewind 10 seconds">
        <Icon name="replay" />
      </CtrlBtn>
      <CtrlBtn onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'} primary>
        <Icon name={playing ? 'pause' : 'play'} />
      </CtrlBtn>
      <CtrlBtn onClick={() => onSeekBy(10)} aria-label="Forward 10 seconds">
        <Icon name="forward" />
      </CtrlBtn>

      <div
        className="kui-volume"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <CtrlBtn onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          <Icon name={volumeIcon} />
        </CtrlBtn>
        <div className={cn('kui-volume-slider', showVolumeSlider && 'is-open')}>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume"
            aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
            className="kui-range"
          />
        </div>
      </div>

      <span className="kui-time">
        {formatTime(currentTime)}<span className="kui-time-sep">/</span>{formatTime(duration)}
      </span>

      <CtrlBtn
        onClick={onToggleSettings}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={showSettings}
        active={showSettings}
        className={cn(showSettings && 'kui-btn--spin')}
      >
        <Icon name="settings" />
      </CtrlBtn>

      {enableCast && castState !== 'unavailable' && (
        <CtrlBtn
          onClick={onToggleCast}
          aria-label={castState === 'connected' ? 'Stop casting' : 'Cast to device'}
          aria-pressed={castState === 'connected'}
          active={castState === 'connected' || castState === 'connecting'}
          className={cn(castState === 'connecting' && 'kui-btn--pulse')}
        >
          <Icon name="cast" />
        </CtrlBtn>
      )}

      {showPip && (
        <CtrlBtn
          onClick={onTogglePip}
          aria-label={isPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
          aria-pressed={isPip}
          active={isPip}
          disabled={castState === 'connected'}
        >
          <Icon name="pip" />
        </CtrlBtn>
      )}

      <CtrlBtn onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
        <Icon name={isFullscreen ? 'compress' : 'expand'} />
      </CtrlBtn>
    </div>
  );
}
