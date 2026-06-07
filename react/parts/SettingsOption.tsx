import { cn } from '../../libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

type SettingsOptionProps = { label: string; sublabel?: string; selected: boolean; onClick: () => void };

export function SettingsOption({ label, sublabel, selected, onClick }: SettingsOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-white/10',
        selected ? 'text-primary font-semibold' : 'text-white/80',
      )}
    >
      <span className="flex flex-col items-start gap-0.5">
        <span>{label}</span>
        {sublabel && <span className="text-xs text-white/35 font-normal">{sublabel}</span>}
      </span>
      {selected && <FontAwesomeIcon icon={faCheck} className="text-primary text-xs shrink-0" aria-hidden="true" />}
    </button>
  );
}
