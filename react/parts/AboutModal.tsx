import { useRef, type ReactNode } from 'react';
import { cn } from '../../libs/utils/cn.js';
import { Icon } from '../icons/index.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

/*
 * The three link marks live here rather than in the shared icon set: this
 * dialog is a lazy chunk, and nothing else in the player draws them.
 */
const LINK_ICONS = {
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14A7.8 7.8 0 0 1 4 12c0-.69.1-1.36.26-2h3.38a16.5 16.5 0 0 0 0 4H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82A13.9 13.9 0 0 1 12 19.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3V9zm7 0h3.8v1.71h.05a4.17 4.17 0 0 1 3.75-2.06c4.01 0 4.75 2.64 4.75 6.07V21h-4v-5.5c0-1.31-.02-3-1.83-3-1.83 0-2.11 1.43-2.11 2.9V21h-4V9z',
  npm: 'M2 4v16h9.33v-2.67H16V20h6V4H2zm2.67 2.67h4V16H6.67V9.33H5.33V16H4.67V6.67zm5.33 0h4V16h-2.67V9.33h-1.33V16h-.67V6.67h.67zm5.33 0h4V16h-1.33V9.33h-1.33V16h-1.34V6.67z',
} as const;

function LinkIcon({ name }: { name: keyof typeof LINK_ICONS }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={LINK_ICONS[name]} />
    </svg>
  );
}
import { PLAYER_META } from '../../modules/videoplayer/videoplayer.meta.js';

/**
 * In-player "About" dialog (opened from the settings menu). Rendered INLINE
 * inside the player — no portal to document.body — so it stays within the
 * shadow-root overlay when the player skins a page video.
 */
export function AboutModal({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Modal semantics for real: focus enters the dialog, cannot leave it while it
  // is open, `Esc` closes it, and focus returns to the settings row behind it.
  useFocusTrap(cardRef, open, onClose);

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
      <div className="kui-modal-card" ref={cardRef} tabIndex={-1}>
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
}: Readonly<{ href: string; icon: keyof typeof LINK_ICONS; label: string; mono?: boolean }>) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="kui-link">
      <LinkIcon name={icon} />
      <span className={cn(mono && 'kui-mono')}>{label}</span>
    </a>
  );
}
