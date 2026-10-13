import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons/index.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useFormatTime, useTranslate } from '../i18n/index.js';
import {
  WATCH_BUCKETS, WatchedMap, makeNote, notesToJson, notesToMarkdown, parseNotes, sortNotes, type Note,
} from '../../modules/videoplayer/videoplayer.learning.js';
import { PlayerStorage, type PersistOptions } from '../../modules/videoplayer/videoplayer.persist.js';

export type LearningOptions = {
  /** Called when the share of the video watched changes (whole percent) — for your own LMS or analytics. */
  onProgress?: (percent: number) => void;
};

type Props = {
  options: LearningOptions;
  /** The page's source URL, which keys the saved notes and progress. */
  src: string;
  title?: string;
  /** Where to keep notes and progress. Without it they live only until the page closes. */
  persist: PersistOptions | null;
};

/** Faster than this is skimming, not studying. */
const MAX_COUNTED_SPEED = 4;

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Study mode: timestamped notes with export, and a map of what has actually
 * been watched. Notes and progress stay in the browser — kept across visits
 * only when `persist` is on, otherwise gone with the page (and the panel says so).
 */
export default function LearningPanel({ options, src, title, persist }: Props) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const formatTime = useFormatTime();
  const [storage] = useState(() => (persist ? new PlayerStorage(persist) : null));
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [watched, setWatched] = useState(() => new WatchedMap());
  const [percent, setPercent] = useState(0);
  const [draft, setDraft] = useState('');
  const [draftTime, setDraftTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, open, () => setOpen(false));
  const onProgress = useRef(options.onProgress);
  useEffect(() => { onProgress.current = options.onProgress; });

  // What this source already has, read when the source changes — adjusted during render
  // rather than in an effect, so there is never a frame showing the previous source's notes.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== src) {
    setLoadedFor(src);
    setNotes(parseNotes(storage?.readStudy('notes', src)));
    const saved = storage?.readStudy<boolean[]>('watched', src);
    const map = new WatchedMap(WATCH_BUCKETS, Array.isArray(saved) ? saved : undefined);
    setWatched(map);
    setPercent(map.percent);
  }

  // Count only continuous playback at a studying pace.
  useEffect(() => {
    let last = engine.store.getState().currentTime;
    return engine.store.subscribe((state) => {
      const now = state.currentTime;
      if (now === last) return;
      if (state.playing && state.speed <= MAX_COUNTED_SPEED) {
        watched.mark(last, now, state.duration);
        const next = watched.percent;
        setPercent((previous) => {
          if (next !== previous) {
            onProgress.current?.(next);
            storage?.writeStudy('watched', src, watched.toArray());
          }
          return next;
        });
      }
      last = now;
    });
  }, [engine, watched, storage, src]);

  const save = (next: Note[]) => { setNotes(next); storage?.writeStudy('notes', src, next); };

  const add = () => {
    const note = makeNote(draftTime, draft);
    if (!note) return;
    save([...notes, note]);
    setDraft('');
  };

  const sorted = useMemo(() => sortNotes(notes), [notes]);
  const heading = title ?? t('notes');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notesToMarkdown(notes, heading, formatTime));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the download buttons still work */ }
  };

  return (
    <>
      <button type="button" className="kui-btn-outline kui-learning-toggle" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t('notes')} · {t('watchedPercent', { percent })}
      </button>
      {open && (
        <div className="kui-modal" role="dialog" aria-modal="true" aria-labelledby="kui-notes-title" onClick={(e) => e.stopPropagation()}>
          <div className="kui-modal-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="kui-modal-card" ref={cardRef} tabIndex={-1}>
            <div className="kui-modal-head">
              <h2 id="kui-notes-title">{t('notes')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="kui-modal-close"><Icon name="close" /></button>
            </div>
            <div className="kui-modal-body">
              <div>
                <p className="kui-label">{t('watchedPercent', { percent })}</p>
                <div className="kui-watched" role="img" aria-label={t('watchedPercent', { percent })}>
                  {watched.runs().map((r) => (
                    <span key={r.start} className="kui-watched-run" style={{ insetInlineStart: `${r.start * 100}%`, width: `${(r.end - r.start) * 100}%` }} />
                  ))}
                </div>
              </div>
              <form className="kui-frametools-row" onSubmit={(e) => { e.preventDefault(); add(); }}>
                <input
                  className="kui-frametools-input kui-note-input"
                  value={draft}
                  placeholder={t('noteAt', { time: formatTime(draftTime) })}
                  aria-label={t('noteAt', { time: formatTime(draftTime) })}
                  // The note belongs to the moment you started typing, not to when you hit Enter.
                  onFocus={() => { if (draft === '') setDraftTime(engine.store.getState().currentTime); }}
                  onChange={(e) => {
                    if (draft === '') setDraftTime(engine.store.getState().currentTime);
                    setDraft(e.target.value);
                  }}
                />
                <button type="submit" className="kui-btn-outline">{t('addNote')}</button>
              </form>
              {sorted.length === 0 && <p className="kui-modal-sub">{t('noNotes')}</p>}
              <ul className="kui-search-results" aria-label={t('notes')}>
                {sorted.map((note) => (
                  <li key={note.id} className="kui-note">
                    <button type="button" className="kui-search-hit" onClick={() => { engine.seek(note.time); setOpen(false); }}>
                      <span className="kui-search-time">{formatTime(note.time)}</span>
                      <span>{note.text}</span>
                    </button>
                    <button type="button" className="kui-modal-close" aria-label={t('deleteNote')} onClick={() => save(notes.filter((n) => n.id !== note.id))}>
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
              </ul>
              {!storage && <p className="kui-modal-sub">{t('notesNotSaved')}</p>}
            </div>
            <div className="kui-modal-foot kui-editor-foot">
              <button type="button" className="kui-btn-outline" disabled={notes.length === 0} onClick={() => { void copy(); }}>
                {copied ? t('copied') : t('copy')}
              </button>
              <button type="button" className="kui-btn-outline" disabled={notes.length === 0}
                onClick={() => download('notes.md', notesToMarkdown(notes, heading, formatTime), 'text/markdown')}>
                {t('exportMarkdown')}
              </button>
              <button type="button" className="kui-btn-outline" disabled={notes.length === 0}
                onClick={() => download('notes.json', notesToJson(notes, heading), 'application/json')}>
                {t('exportJson')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
