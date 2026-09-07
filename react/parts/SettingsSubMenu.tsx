import { Icon } from '../icons';

type SettingsSubMenuProps = { title: string; onBack: () => void; children: React.ReactNode };

export function SettingsSubMenu({ title, onBack, children }: SettingsSubMenuProps) {
  return (
    <div>
      <button type="button" onClick={onBack} className="kui-back">
        <Icon name="chevronLeft" />
        <span>{title}</span>
      </button>
      <div className="kui-panel-body" role="menu">{children}</div>
    </div>
  );
}
