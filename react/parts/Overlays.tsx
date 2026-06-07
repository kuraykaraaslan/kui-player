import { cn } from '../../libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { faChromecast } from '@fortawesome/free-brands-svg-icons';
import { SUBTITLE_SIZES } from '../../modules/videoplayer/videoplayer.constants';
import type { SubtitleFontSize } from '../../modules/videoplayer/videoplayer.types';

export function CastOverlay({ castDeviceName, title }: { castDeviceName: string | null; title?: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 gap-3 text-center px-6"
      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)' }}
    >
      <FontAwesomeIcon icon={faChromecast} className="text-white text-5xl drop-shadow-lg" aria-hidden="true" />
      <p className="text-white/90 text-sm font-medium">
        {castDeviceName ? `Casting to ${castDeviceName}` : 'Casting to device'}
      </p>
      {title && <p className="text-white/60 text-xs max-w-[90%] truncate">{title}</p>}
    </div>
  );
}

export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
      <FontAwesomeIcon icon={faSpinner} className="text-white text-4xl animate-spin drop-shadow-lg" aria-hidden="true" />
    </div>
  );
}

export function CenterPlayOverlay({ playing }: { playing: boolean }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center pointer-events-none',
        'transition-opacity duration-300 ease-out',
        playing ? 'opacity-0' : 'opacity-100',
      )}
      aria-hidden="true"
    >
      <div className={cn(
        'w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm',
        'flex items-center justify-center shadow-2xl ring-2 ring-white/20',
        'transition-transform duration-300 ease-out',
        playing ? 'scale-125' : 'scale-100',
      )}>
        <FontAwesomeIcon icon={faPlay} className="text-white text-2xl ml-1" />
      </div>
    </div>
  );
}

export function SubtitleOverlay({
  cueText, effectiveControls, subtitleFontSize,
}: {
  cueText: string;
  effectiveControls: boolean;
  subtitleFontSize: SubtitleFontSize;
}) {
  return (
    <div className={cn(
      'absolute left-0 right-0 flex justify-center px-6 pointer-events-none z-10 transition-all duration-300',
      effectiveControls ? 'bottom-[4.5rem]' : 'bottom-4',
    )}>
      <span
        className="bg-black/80 text-white px-3 py-1 rounded-md text-center max-w-[85%] whitespace-pre-line leading-snug font-medium"
        style={{ fontSize: SUBTITLE_SIZES[subtitleFontSize] }}
      >
        {cueText}
      </span>
    </div>
  );
}
