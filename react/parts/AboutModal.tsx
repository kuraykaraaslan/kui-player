import { useEffect } from 'react';
import { cn } from '../../libs/utils/cn';
import { Icon, type IconName } from '../icons';
import { PLAYER_META } from '../../modules/videoplayer/videoplayer.meta';

/**
 * In-player "About" dialog (opened from the settings menu). Rendered INLINE
 * inside the player — no portal to document.body — so it stays within the
 * shadow-root overlay when the player skins a page video.
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
      className="kui-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kui-about-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="kui-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="kui-modal-card">
        <div className="kui-modal-head">
          <div>
            <h2 id="kui-about-title">{PLAYER_META.name}</h2>
            <p className="kui-modal-sub">{PLAYER_META.tagline} · v{PLAYER_META.version}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="kui-modal-close">
            <Icon name="close" />
          </button>
        </div>

        <div className="kui-modal-body">
          <div>
            <p className="kui-label">Author</p>
            <p className="kui-value">{PLAYER_META.author}</p>
          </div>
          <div className="kui-links">
            <AboutLink href={PLAYER_META.website} icon="globe" label={PLAYER_META.websiteLabel} />
            <AboutLink href={PLAYER_META.linkedin} icon="linkedin" label={PLAYER_META.linkedinLabel} />
            <AboutLink href={PLAYER_META.npmUrl} icon="npm" label={PLAYER_META.npm} mono />
          </div>
        </div>

        <div className="kui-modal-foot">
          <button type="button" onClick={onClose} className="kui-btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
}

function AboutLink({
  href, icon, label, mono = false,
}: Readonly<{ href: string; icon: IconName; label: string; mono?: boolean }>) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="kui-link">
      <Icon name={icon} />
      <span className={cn(mono && 'kui-mono')}>{label}</span>
    </a>
  );
}
