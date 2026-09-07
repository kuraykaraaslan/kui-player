import { forwardRef } from 'react';
import { Icon } from '../icons/index.js';
import { SettingsRow } from './SettingsRow.js';
import { SettingsSubMenu } from './SettingsSubMenu.js';
import { SettingsOption } from './SettingsOption.js';
import { SPEEDS, SUBTITLE_SIZES, SUBTITLE_SIZE_LABELS } from '../../modules/videoplayer/videoplayer.constants.js';
import { PLAYER_META } from '../../modules/videoplayer/videoplayer.meta.js';
import { AUTO_QUALITY_VALUE } from '../../modules/videoplayer/adapters/adapter.types.js';
import type {
  QualityOption, SubtitleTrack, AudioTrackOption, SettingsView, SubtitleFontSize,
} from '../../modules/videoplayer/videoplayer.types.js';

type SettingsPanelProps = {
  view: SettingsView;
  onChangeView: (view: SettingsView) => void;
  onAbout: () => void;
  qualities?: QualityOption[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  selectedQuality: string;
  /** Rendition ABR actually settled on — shown beside "Auto". */
  activeQualityLabel?: string | null;
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
    selectedQuality, activeQualityLabel, selectedSubtitle, selectedAudioTrack,
    speed, subtitleFontSize,
    applyQuality, applySpeed, applySubtitle, applySubtitleSize, applyAudioTrack,
  },
  ref,
) {
  const currentQualityLabel = selectedQuality === AUTO_QUALITY_VALUE
    ? (activeQualityLabel ? `Auto · ${activeQualityLabel}` : 'Auto')
    : (qualities?.find((q) => q.value === selectedQuality)?.label ?? 'Auto');
  const currentSubtitleLabel = selectedSubtitle !== null ? (subtitles?.[selectedSubtitle]?.label ?? 'Off') : 'Off';
  const currentAudioLabel = audioTracks?.[selectedAudioTrack]?.label ?? '';

  return (
    <div
      ref={ref}
      className="kui-panel"
      tabIndex={-1}
    >
      {view === 'main' && (
        <>
          <div className="kui-panel-head">
            <Icon name="settings" />
            <p>Settings</p>
          </div>
          <div className="kui-panel-body" role="menu" aria-label="Player settings">
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
            <SettingsOption
              key={q.value}
              label={q.label}
              sublabel={q.value === AUTO_QUALITY_VALUE && activeQualityLabel ? `currently ${activeQualityLabel}` : undefined}
              selected={selectedQuality === q.value}
              onClick={() => applyQuality(q.value)}
            />
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
