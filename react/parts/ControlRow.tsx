import { useState } from 'react';
import { cn } from '../../libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay, faPause, faVolumeHigh, faVolumeLow, faVolumeOff,
  faExpand, faCompress, faRotateLeft, faRotateRight, faGear,
} from '@fortawesome/free-solid-svg-icons';
import { faChromecast } from '@fortawesome/free-brands-svg-icons';
import { CtrlBtn } from './CtrlBtn';
import { formatTime } from '../../modules/videoplayer/videoplayer.format';
import type { CastState } from '../../modules/videoplayer/videoplayer.types';

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
  enableCast, castState, onPlay, onSeekBy, onToggleMute, onVolumeChange,
  onToggleSettings, onToggleCast, onToggleFullscreen,
}: ControlRowProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeIcon = muted || volume === 0 ? faVolumeOff : volume < 0.5 ? faVolumeLow : faVolumeHigh;

  return (
    <div className="flex items-center gap-1">
      <CtrlBtn onClick={() => onSeekBy(-10)} aria-label="Rewind 10 seconds">
        <FontAwesomeIcon icon={faRotateLeft} className="text-sm" aria-hidden="true" />
      </CtrlBtn>
      <CtrlBtn onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'} primary>
        <FontAwesomeIcon icon={playing ? faPause : faPlay} className="text-base" aria-hidden="true" />
      </CtrlBtn>
      <CtrlBtn onClick={() => onSeekBy(10)} aria-label="Forward 10 seconds">
        <FontAwesomeIcon icon={faRotateRight} className="text-sm" aria-hidden="true" />
      </CtrlBtn>

      <div
        className="flex items-center gap-1.5"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <CtrlBtn onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          <FontAwesomeIcon icon={volumeIcon} className="text-sm" aria-hidden="true" />
        </CtrlBtn>
        <div className={cn('overflow-hidden transition-all duration-200 ease-out', showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0')}>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume"
            className="w-full h-1 cursor-pointer accent-primary"
          />
        </div>
      </div>

      <span className="text-white/70 text-xs tabular-nums flex-1 pl-1 select-none">
        {formatTime(currentTime)}<span className="text-white/30 mx-0.5">/</span>{formatTime(duration)}
      </span>

      <CtrlBtn onClick={onToggleSettings} aria-label="Settings" aria-expanded={showSettings} active={showSettings}>
        <FontAwesomeIcon icon={faGear} className={cn('text-sm transition-transform duration-300', showSettings && 'rotate-[30deg]')} aria-hidden="true" />
      </CtrlBtn>

      {enableCast && castState !== 'unavailable' && (
        <CtrlBtn
          onClick={onToggleCast}
          aria-label={castState === 'connected' ? 'Stop casting' : 'Cast to device'}
          aria-pressed={castState === 'connected'}
          active={castState === 'connected' || castState === 'connecting'}
        >
          <FontAwesomeIcon icon={faChromecast} className={cn('text-sm', castState === 'connecting' && 'animate-pulse')} aria-hidden="true" />
        </CtrlBtn>
      )}

      <CtrlBtn onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
        <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} className="text-sm" aria-hidden="true" />
      </CtrlBtn>
    </div>
  );
}
