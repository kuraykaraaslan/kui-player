import { useState } from 'react';
import { cn } from '../../libs/utils/cn.js';
import { Icon, type IconName } from '../icons/index.js';
import { CtrlBtn } from './CtrlBtn.js';
import { useFormatTime, useTranslate } from '../i18n/index.js';
import type { CastState } from '../../modules/videoplayer/videoplayer.types.js';

type ControlRowProps = {
  /** Consumer nodes at either end of the row. */
  slotStart?: React.ReactNode;
  slotEnd?: React.ReactNode;
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
  /** AirPlay: only shown once Safari reports a target on the network. */
  showAirPlay: boolean;
  isAirPlaying: boolean;
  onAirPlay: () => void;
  isLive: boolean;
  atLiveEdge: boolean;
  onGoLive: () => void;
  onPlay: () => void;
  onSeekBy: (delta: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (val: number) => void;
  onToggleSettings: () => void;
  onToggleCast: () => void;
  onToggleFullscreen: () => void;
};

export function ControlRow({
  slotStart, slotEnd,
  playing, muted, volume, currentTime, duration, isFullscreen, showSettings,
  enableCast, castState, showPip, isPip, onTogglePip,
  showAirPlay, isAirPlaying, onAirPlay, isLive, atLiveEdge, onGoLive,
  onPlay, onSeekBy, onToggleMute, onVolumeChange,
  onToggleSettings, onToggleCast, onToggleFullscreen,
}: ControlRowProps) {
  const t = useTranslate();
  const formatTime = useFormatTime();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeIcon: IconName = muted || volume === 0 ? 'volumeOff' : volume < 0.5 ? 'volumeLow' : 'volumeHigh';

  return (
    <div className="kui-row">
      {slotStart && <span className="kui-slot kui-slot--controls-start">{slotStart}</span>}
      <CtrlBtn onClick={() => onSeekBy(-10)} aria-label={t('rewind', { seconds: 10 })}>
        <Icon name="replay" />
      </CtrlBtn>
      <CtrlBtn onClick={onPlay} aria-label={playing ? t('pause') : t('play')} primary>
        <Icon name={playing ? 'pause' : 'play'} />
      </CtrlBtn>
      <CtrlBtn onClick={() => onSeekBy(10)} aria-label={t('forward', { seconds: 10 })}>
        <Icon name="forward" />
      </CtrlBtn>

      <div
        className="kui-volume"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <CtrlBtn onClick={onToggleMute} aria-label={muted ? t('unmute') : t('mute')}>
          <Icon name={volumeIcon} />
        </CtrlBtn>
        <div className={cn('kui-volume-slider', showVolumeSlider && 'is-open')}>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label={t('volume')}
            aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
            className="kui-range"
          />
        </div>
      </div>

      {isLive ? (
        // A live stream has no meaningful total, so the clock is replaced by a
        // badge that doubles as "jump back to the edge".
        <button
          type="button"
          onClick={onGoLive}
          className={cn('kui-live', atLiveEdge && 'is-edge')}
          aria-label={atLiveEdge ? t('live') : t('goLive')}
          disabled={atLiveEdge}
        >
          <span className="kui-live-dot" aria-hidden="true" />
          {t('live')}
        </button>
      ) : (
        <span className="kui-time">
          {formatTime(currentTime)}<span className="kui-time-sep">/</span>{formatTime(duration)}
        </span>
      )}
      {isLive && <span className="kui-time kui-time--live">{formatTime(currentTime)}</span>}

      <CtrlBtn
        onClick={onToggleSettings}
        aria-label={t('settings')}
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
          aria-label={castState === 'connected' ? t('stopCasting') : t('castToDevice')}
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
          aria-label={isPip ? t('exitPictureInPicture') : t('pictureInPicture')}
          aria-pressed={isPip}
          active={isPip}
          disabled={castState === 'connected'}
        >
          <Icon name="pip" />
        </CtrlBtn>
      )}

      {showAirPlay && (
        <CtrlBtn onClick={onAirPlay} aria-label={t('airPlay')} aria-pressed={isAirPlaying} active={isAirPlaying}>
          <Icon name="airplay" />
        </CtrlBtn>
      )}

      <CtrlBtn onClick={onToggleFullscreen} aria-label={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}>
        <Icon name={isFullscreen ? 'compress' : 'expand'} />
      </CtrlBtn>
      {slotEnd && <span className="kui-slot kui-slot--controls-end">{slotEnd}</span>}
    </div>
  );
}
