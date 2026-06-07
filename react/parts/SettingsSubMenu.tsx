import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';

type SettingsSubMenuProps = { title: string; onBack: () => void; children: React.ReactNode };

export function SettingsSubMenu({ title, onBack, children }: SettingsSubMenuProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-white/10 hover:bg-white/5 transition-colors"
      >
        <FontAwesomeIcon icon={faChevronLeft} className="text-white/50 text-xs" aria-hidden="true" />
        <span className="text-white text-sm font-semibold">{title}</span>
      </button>
      <div className="py-1">{children}</div>
    </div>
  );
}
