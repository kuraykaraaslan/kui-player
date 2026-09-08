import { forwardRef } from 'react';
import { Icon } from '../icons/index.js';
import { SettingsRow } from './SettingsRow.js';
import { SettingsSubMenu } from './SettingsSubMenu.js';
import { SettingsOption } from './SettingsOption.js';
import {
  SPEEDS, SUBTITLE_SIZES, SUBTITLE_SIZE_LABELS,
  SUBTITLE_BACKGROUNDS, SUBTITLE_COLORS, SUBTITLE_EDGES, SUBTITLE_FONTS,
} from '../../modules/videoplayer/videoplayer.constants.js';
import { PLAYER_META } from '../../modules/videoplayer/videoplayer.meta.js';
import { AUTO_QUALITY_VALUE } from '../../modules/videoplayer/adapters/adapter.types.js';
import { useTranslate } from '../i18n/index.js';
import { formatTime } from '../../modules/videoplayer/videoplayer.format.js';
import type { Chapter } from '../../modules/videoplayer/videoplayer.vtt.js';
import type {
  QualityOption, SubtitleTrack, AudioTrackOption, SettingsView,
  SubtitleEdge, SubtitleFont, SubtitleFontSize,
} from '../../modules/videoplayer/videoplayer.types.js';

type SettingsPanelProps = {
  view: SettingsView;
  onChangeView: (view: SettingsView) => void;
  onAbout: () => void;
  qualities?: QualityOption[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  chapters?: Chapter[];
  onSeekTo?: (time: number) => void;
  selectedQuality: string;
  /** Rendition ABR actually settled on — shown beside "Auto". */
  activeQualityLabel?: string | null;
  selectedSubtitle: number | null;
  selectedAudioTrack: number;
  speed: number;
  subtitleFontSize: SubtitleFontSize;
  subtitleColor: string;
  subtitleBackground: number;
  subtitleEdge: SubtitleEdge;
  subtitleFont: SubtitleFont;
  applyQuality: (value: string) => void;
  applySpeed: (s: number) => void;
  applySubtitle: (index: number | null) => void;
  applySubtitleSize: (size: SubtitleFontSize) => void;
  applySubtitleColor: (color: string) => void;
  applySubtitleBackground: (value: number) => void;
  applySubtitleEdge: (edge: SubtitleEdge) => void;
  applySubtitleFont: (font: SubtitleFont) => void;
  applyAudioTrack: (index: number) => void;
};

export const SettingsPanel = forwardRef<HTMLDivElement, SettingsPanelProps>(function SettingsPanel(
  {
    view, onChangeView, onAbout, qualities, subtitles, audioTracks, chapters, onSeekTo,
    selectedQuality, activeQualityLabel, selectedSubtitle, selectedAudioTrack,
    speed, subtitleFontSize, subtitleColor, subtitleBackground, subtitleEdge, subtitleFont,
    applyQuality, applySpeed, applySubtitle, applySubtitleSize, applyAudioTrack,
    applySubtitleColor, applySubtitleBackground, applySubtitleEdge, applySubtitleFont,
  },
  ref,
) {
  const t = useTranslate();
  const currentQualityLabel = selectedQuality === AUTO_QUALITY_VALUE
    ? (activeQualityLabel ? `${t('auto')} · ${activeQualityLabel}` : t('auto'))
    : (qualities?.find((q) => q.value === selectedQuality)?.label ?? t('auto'));
  const currentSubtitleLabel = selectedSubtitle !== null
    ? (subtitles?.[selectedSubtitle]?.label ?? t('off'))
    : t('off');
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
            <p>{t('settings')}</p>
          </div>
          <div className="kui-panel-body" role="menu" aria-label="Player settings">
            {qualities && qualities.length > 0 && (
              <SettingsRow label={t('quality')} value={currentQualityLabel} onClick={() => onChangeView('quality')} />
            )}
            <SettingsRow label={t('playbackSpeed')} value={speed === 1 ? t('normal') : `${speed}×`} onClick={() => onChangeView('speed')} />
            {subtitles && subtitles.length > 0 && (
              <>
                <SettingsRow label={t('subtitles')} value={currentSubtitleLabel} onClick={() => onChangeView('subtitles')} />
                <SettingsRow label={t('subtitleSize')} value={SUBTITLE_SIZE_LABELS[subtitleFontSize]} onClick={() => onChangeView('subtitle-size')} />
                <SettingsRow
                  label={t('subtitleStyle')}
                  value={SUBTITLE_COLORS.find((c) => c.value === subtitleColor)?.label ?? ''}
                  onClick={() => onChangeView('subtitle-style')}
                />
              </>
            )}
            {audioTracks && audioTracks.length > 1 && (
              <SettingsRow label={t('audioLanguage')} value={currentAudioLabel} onClick={() => onChangeView('language')} />
            )}
            {chapters && chapters.length > 0 && (
              <SettingsRow
                label={t('chapters')}
                value={String(chapters.length)}
                onClick={() => onChangeView('chapters')}
              />
            )}
            <SettingsRow label={t('about')} value={`v${PLAYER_META.version}`} onClick={onAbout} />
          </div>
        </>
      )}

      {view === 'quality' && qualities && (
        <SettingsSubMenu title={t('quality')} onBack={() => onChangeView('main')}>
          {qualities.map((q) => (
            <SettingsOption
              key={q.value}
              label={q.label}
              sublabel={q.value === AUTO_QUALITY_VALUE && activeQualityLabel
                ? t('currently', { label: activeQualityLabel })
                : undefined}
              selected={selectedQuality === q.value}
              onClick={() => applyQuality(q.value)}
            />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'speed' && (
        <SettingsSubMenu title={t('playbackSpeed')} onBack={() => onChangeView('main')}>
          {SPEEDS.map((s) => (
            <SettingsOption key={s} label={s === 1 ? '1× (Normal)' : `${s}×`} selected={speed === s} onClick={() => applySpeed(s)} />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'subtitles' && subtitles && (
        <SettingsSubMenu title={t('subtitles')} onBack={() => onChangeView('main')}>
          <SettingsOption label={t('off')} selected={selectedSubtitle === null} onClick={() => applySubtitle(null)} />
          {subtitles.map((sub, i) => (
            <SettingsOption key={i} label={sub.label} selected={selectedSubtitle === i} onClick={() => applySubtitle(i)} />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'subtitle-size' && (
        <SettingsSubMenu title={t('subtitleSize')} onBack={() => onChangeView('main')}>
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

      {view === 'subtitle-style' && (
        <SettingsSubMenu title={t('subtitleStyle')} onBack={() => onChangeView('main')}>
          <p className="kui-settings-group">{t('subtitleStyle')}</p>
          {SUBTITLE_COLORS.map((color) => (
            <SettingsOption
              key={color.value}
              label={color.label}
              selected={subtitleColor === color.value}
              onClick={() => applySubtitleColor(color.value)}
            />
          ))}
          {SUBTITLE_BACKGROUNDS.map((option) => (
            <SettingsOption
              key={`bg-${option.value}`}
              label={option.label}
              selected={subtitleBackground === option.value}
              onClick={() => applySubtitleBackground(option.value)}
            />
          ))}
          {SUBTITLE_EDGES.map((option) => (
            <SettingsOption
              key={`edge-${option.value}`}
              label={option.label}
              selected={subtitleEdge === option.value}
              onClick={() => applySubtitleEdge(option.value)}
            />
          ))}
          {SUBTITLE_FONTS.map((option) => (
            <SettingsOption
              key={`font-${option.value}`}
              label={option.label}
              selected={subtitleFont === option.value}
              onClick={() => applySubtitleFont(option.value)}
            />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'chapters' && chapters && (
        <SettingsSubMenu title={t('chapters')} onBack={() => onChangeView('main')}>
          {chapters.map((chapter) => (
            <SettingsOption
              key={`${chapter.start}-${chapter.title}`}
              label={chapter.title}
              sublabel={formatTime(chapter.start)}
              selected={false}
              onClick={() => onSeekTo?.(chapter.start)}
            />
          ))}
        </SettingsSubMenu>
      )}

      {view === 'language' && audioTracks && (
        <SettingsSubMenu title={t('audioLanguage')} onBack={() => onChangeView('main')}>
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
