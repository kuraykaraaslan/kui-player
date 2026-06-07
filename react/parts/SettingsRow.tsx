import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

type SettingsRowProps = { label: string; value: string; onClick: () => void };

export function SettingsRow({ label, value, onClick }: SettingsRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/10 transition-colors group"
    >
      <span className="text-white/85 text-sm">{label}</span>
      <div className="flex items-center gap-1.5 text-white/45 text-xs group-hover:text-white/65 transition-colors">
        <span>{value}</span>
        <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" aria-hidden="true" />
      </div>
    </button>
  );
}
