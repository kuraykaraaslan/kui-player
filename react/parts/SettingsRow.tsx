import { Icon } from '../icons';

type SettingsRowProps = { label: string; value: string; onClick: () => void };

export function SettingsRow({ label, value, onClick }: SettingsRowProps) {
  return (
    <button type="button" onClick={onClick} className="kui-menu-row">
      <span>{label}</span>
      <span className="kui-menu-row-value">
        <span>{value}</span>
        <Icon name="chevronRight" />
      </span>
    </button>
  );
}
