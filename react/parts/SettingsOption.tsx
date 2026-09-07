import { cn } from '../../libs/utils/cn';
import { Icon } from '../icons';

type SettingsOptionProps = { label: string; sublabel?: string; selected: boolean; onClick: () => void };

export function SettingsOption({ label, sublabel, selected, onClick }: SettingsOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemradio"
      aria-checked={selected}
      className={cn('kui-option', selected && 'is-selected')}
    >
      <span className="kui-option-labels">
        <span>{label}</span>
        {sublabel && <span className="kui-option-sub">{sublabel}</span>}
      </span>
      {selected && <Icon name="check" />}
    </button>
  );
}
