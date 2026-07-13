import { useEffect } from 'react';
import { cn } from '../../libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faNpm } from '@fortawesome/free-brands-svg-icons';
import { PLAYER_META } from '../../modules/videoplayer/videoplayer.meta';

/**
 * In-player "About" dialog (opened from the settings menu). Ported from the kui-react `Modal` design —
 * same token-styled panel/backdrop/header — but rendered INLINE inside the player (no portal to
 * document.body), so it stays within the shadow-root overlay when the player skins a page video.
 */
export function AboutModal({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kui-about-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          'relative z-[61] flex w-full max-w-sm max-h-full flex-col overflow-hidden',
          'rounded-xl border border-border bg-surface-raised text-text-primary shadow-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="kui-about-title" className="text-base font-semibold text-text-primary">
              {PLAYER_META.name}
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {PLAYER_META.tagline} · v{PLAYER_META.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded text-text-disabled transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-secondary">Author</p>
            <p className="mt-0.5 text-sm font-medium text-text-primary">{PLAYER_META.author}</p>
          </div>
          <div className="space-y-1.5">
            <AboutLink href={PLAYER_META.website} icon={faGlobe} label={PLAYER_META.websiteLabel} />
            <AboutLink href={PLAYER_META.linkedin} icon={faLinkedin} label={PLAYER_META.linkedinLabel} />
            <AboutLink href={PLAYER_META.npmUrl} icon={faNpm} label={PLAYER_META.npm} mono />
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AboutLink({
  href, icon, label, mono = false,
}: Readonly<{ href: string; icon: typeof faGlobe; label: string; mono?: boolean }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <FontAwesomeIcon icon={icon} className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
      <span className={cn('truncate', mono && 'font-mono text-xs')}>{label}</span>
    </a>
  );
}
