import { cn } from '../../libs/utils/cn';

type CtrlBtnProps = {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function CtrlBtn({ onClick, children, primary, active, className, ...rest }: CtrlBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('kui-btn', primary && 'kui-btn--primary', active && 'is-active', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
