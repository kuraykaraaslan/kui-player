import { Icon } from '../icons/index.js';

type SettingsRowProps = {
  label: string;
  value: string;
  onClick: () => void;
  /** Makes the row a switch (`menuitemcheckbox`) instead of a link to a submenu. */
  checked?: boolean;
};

export function SettingsRow({ label, value, onClick, checked }: SettingsRowProps) {
  const isSwitch = checked !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      role={isSwitch ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={isSwitch ? checked : undefined}
      className="kui-menu-row"
    >
      <span>{label}</span>
      <span className="kui-menu-row-value">
        <span>{value}</span>
        {!isSwitch && <Icon name="chevronRight" />}
      </span>
    </button>
  );
}
