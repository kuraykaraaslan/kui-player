import { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { SettingsRow } from './SettingsRow';
import { SettingsSubMenu } from './SettingsSubMenu';
import { SettingsOption } from './SettingsOption';
import { SPEEDS, SUBTITLE_SIZES, SUBTITLE_SIZE_LABELS } from '../../modules/videoplayer/videoplayer.constants';
import { PLAYER_META } from '../../modules/videoplayer/videoplayer.meta';
import type {
  QualityOption, SubtitleTrack, AudioTrackOption, SettingsView, SubtitleFontSize,
} from '../../modules/videoplayer/videoplayer.types';

type SettingsPanelProps = {
  view: SettingsView;
  onChangeView: (view: SettingsView) => void;
  onAbout: () => void;
  qualities?: QualityOption[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  selectedQuality: string;
  selectedSubtitle: number | null;
  selectedAudioTrack: number;
  speed: number;
  subtitleFontSize: SubtitleFontSize;
  applyQuality: (value: string) => void;
  applySpeed: (s: number) => void;
  applySubtitle: (index: number | null) => void;
  applySubtitleSize: (size: SubtitleFontSize) => void;
  applyAudioTrack: (index: number) => void;
};

export const SettingsPanel = forwardRef<HTMLDivElement, SettingsPanelProps>(function SettingsPanel(
  {
    view, onChangeView, onAbout, qualities, subtitles, audioTracks,
    selectedQuality, selectedSubtitle, selectedAudioTrack,
    speed, subtitleFontSize,
    applyQuality, applySpeed, applySubtitle, applySubtitleSize, applyAudioTrack,
  },
  ref,
) {
  const currentQualityLabel = qualities?.find((q) => q.value === selectedQuality)?.label ?? 'Auto';
  const currentSubtitleLabel = selectedSubtitle !== null ? (subtitles?.[selectedSubtitle]?.label ?? 'Off') : 'Off';
  const currentAudioLabel = audioTracks?.[selectedAudioTrack]?.label ?? '';

  return (
    <div
      ref={ref}
      className="absolute bottom-14 right-4 w-60 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden z-20"
    >
      {view === 'main' && (
        <>
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
            <FontAwesomeIcon icon={faGear} className="text-white/50 text-xs" aria-hidden="true" />
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Settings</p>
          </div>
          <div className="py-1">
            {qualities && qualities.length > 0 && (
              <SettingsRow label="Quality" value={currentQualityLabel} onClick={() => onChangeView('quality')} />
            )}
            <SettingsRow label="Playback Speed" value={speed === 1 ? 'Normal' : `${speed}×`} onClick={() => onChangeView('speed')} />
            {subtitles && subtitles.length > 0 && (
              <>
                <SettingsRow label="Subtitles" value={currentSubtitleLabel} onClick={() => onChangeView('subtitles')} />
                <SettingsRow label="Subtitle Size" value={SUBTITLE_SIZE_LABELS[subtitleFontSize]} onClick={() => onChangeView('subtitle-size')} />
              </>
            )}
            {audioTracks && audioTracks.length > 1 && (
              <SettingsRow label="Audio Language" value={currentAudioLabel} onClick={() => onChangeView('language')} />
            )}
            <SettingsRow label="About" value={`v${PLAYER_META.version}`} onClick={onAbout} />
          </div>
        </>
      )}

      {view === 'quality' && qualities && (
        <SettingsSubMenu title="Quality" onBack={() => onChangeView('main')}>
          {qualities.map((q) => (
            <SettingsOption key={q.value} label={q.label} selected={selectedQuality === q.value} onClick={() => applyQuality(q.value)} />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'speed' && (
        <SettingsSubMenu title="Playback Speed" onBack={() => onChangeView('main')}>
          {SPEEDS.map((s) => (
            <SettingsOption key={s} label={s === 1 ? '1× (Normal)' : `${s}×`} selected={speed === s} onClick={() => applySpeed(s)} />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'subtitles' && subtitles && (
        <SettingsSubMenu title="Subtitles" onBack={() => onChangeView('main')}>
          <SettingsOption label="Off" selected={selectedSubtitle === null} onClick={() => applySubtitle(null)} />
          {subtitles.map((sub, i) => (
            <SettingsOption key={i} label={sub.label} selected={selectedSubtitle === i} onClick={() => applySubtitle(i)} />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'subtitle-size' && (
        <SettingsSubMenu title="Subtitle Size" onBack={() => onChangeView('main')}>
          {(Object.entries(SUBTITLE_SIZE_LABELS) as [SubtitleFontSize, string][]).map(([key, label]) => (
            <SettingsOption
              key={key}
              label={label}
              sublabel={SUBTITLE_SIZES[key]}
              selected={subtitleFontSize === key}
              onClick={() => applySubtitleSize(key)}
            />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'language' && audioTracks && (
        <SettingsSubMenu title="Audio Language" onBack={() => onChangeView('main')}>
          {audioTracks.map((track, i) => (
            <SettingsOption
              key={i}
              label={track.label}
              sublabel={track.language}
              selected={selectedAudioTrack === i}
              onClick={() => applyAudioTrack(i)}
            />
          ))}
        </SettingsSubMenu>
      )}
    </div>
  );
});
