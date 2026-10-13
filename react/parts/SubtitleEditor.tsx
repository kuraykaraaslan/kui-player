import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons/index.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useTranslate } from '../i18n/index.js';
import {
  parseEditedTime, serializeSrt, serializeVtt, type EditableCue,
} from '../../modules/videoplayer/videoplayer.subtitles.js';

type Props = {
  label: string;
  src: string;
  /** Called with the edited cues; the player adds them as a new track and selects it. */
  onApply: (cues: EditableCue[]) => void;
  onClose: () => void;
};

type Row = { id: number; start: string; end: string; text: string };

const show = (seconds: number) => (Math.round(seconds * 1000) / 1000).toString();
let nextId = 1;

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Edit the text and timing of the chosen subtitle track, then use it right away
 * or save it as SRT / WebVTT. Edits stay on this device — nothing is uploaded.
 */
export default function SubtitleEditor({ label, src, onApply, onClose }: Props) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true, onClose);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      fetch(src, { signal: controller.signal }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
      import('../../modules/videoplayer/videoplayer.subtitles.parse.js'),
    ])
      .then(([text, { parseSubtitles }]) => {
        if (!cancelled) setRows(parseSubtitles(text, src).map((c) => ({ id: nextId++, start: show(c.start), end: show(c.end), text: c.text })));
      })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; controller.abort(); };
  }, [src]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((list) => list?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? list);

  /** Parse every row; mark the bad ones instead of silently dropping or guessing. */
  const collect = (): EditableCue[] | null => {
    const bad = new Set<string>();
    const cues: EditableCue[] = [];
    for (const row of rows ?? []) {
      const start = parseEditedTime(row.start);
      const end = parseEditedTime(row.end);
      if (start === null) bad.add(`${row.id}:start`);
      if (end === null) bad.add(`${row.id}:end`);
      if (start !== null && end !== null) cues.push({ start, end, text: row.text });
    }
    setInvalid(bad);
    return bad.size === 0 ? cues : null;
  };

  const apply = () => {
    const cues = collect();
    if (cues) { onApply(cues); onClose(); }
  };
  const save = (kind: 'srt' | 'vtt') => {
    const cues = collect();
    if (!cues) return;
    const base = label.replace(/\.[a-z0-9]+$/i, '') || 'subtitles';
    if (kind === 'srt') download(`${base}.srt`, serializeSrt(cues), 'application/x-subrip');
    else download(`${base}.vtt`, serializeVtt(cues), 'text/vtt');
  };

  return (
    <div className="kui-modal" role="dialog" aria-modal="true" aria-labelledby="kui-editor-title" onClick={(e) => e.stopPropagation()}>
      <div className="kui-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="kui-modal-card kui-editor" ref={cardRef} tabIndex={-1}>
        <div className="kui-modal-head">
          <h2 id="kui-editor-title">{t('editSubtitles')} · {label}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="kui-modal-close"><Icon name="close" /></button>
        </div>
        <div className="kui-modal-body kui-editor-body">
          {rows === null && <p className="kui-modal-sub" role="status">…</p>}
          {rows !== null && (
            <ol className="kui-editor-rows">
              {rows.map((row) => (
                <li key={row.id} className="kui-editor-row">
                  <input
                    className="kui-frametools-input kui-editor-time"
                    value={row.start}
                    aria-label={t('cueStart')}
                    aria-invalid={invalid.has(`${row.id}:start`) || undefined}
                    onChange={(e) => update(row.id, { start: e.target.value })}
                  />
                  <input
                    className="kui-frametools-input kui-editor-time"
                    value={row.end}
                    aria-label={t('cueEnd')}
                    aria-invalid={invalid.has(`${row.id}:end`) || undefined}
                    onChange={(e) => update(row.id, { end: e.target.value })}
                  />
                  <textarea
                    className="kui-frametools-input kui-editor-text"
                    value={row.text}
                    rows={2}
                    aria-label={t('cueText')}
                    onChange={(e) => update(row.id, { text: e.target.value })}
                  />
                  <button
                    type="button"
                    className="kui-modal-close"
                    aria-label={t('deleteCue')}
                    onClick={() => setRows((list) => list?.filter((r) => r.id !== row.id) ?? list)}
                  >
                    <Icon name="close" />
                  </button>
                </li>
              ))}
            </ol>
          )}
          {invalid.size > 0 && <p className="kui-editor-error" role="alert">{t('invalidTime')}</p>}
        </div>
        <div className="kui-modal-foot kui-editor-foot">
          <button
            type="button"
            className="kui-btn-outline"
            onClick={() => {
              const now = engine.store.getState().currentTime;
              setRows((list) => [...(list ?? []), { id: nextId++, start: show(now), end: show(now + 2), text: '' }]);
            }}
          >
            {t('addCueHere')}
          </button>
          <button type="button" className="kui-btn-outline" onClick={() => save('srt')}>{t('downloadSrt')}</button>
          <button type="button" className="kui-btn-outline" onClick={() => save('vtt')}>{t('downloadVtt')}</button>
          <button type="button" className="kui-btn-outline kui-editor-apply" onClick={apply}>{t('applyEdits')}</button>
        </div>
      </div>
    </div>
  );
}
