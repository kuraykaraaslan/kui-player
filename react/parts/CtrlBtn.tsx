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
      className={cn(
        'flex items-center justify-center rounded transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white',
        primary ? 'w-9 h-9 text-white hover:text-primary' : 'w-8 h-8',
        !primary && active && 'text-primary',
        !primary && !active && 'text-white/80 hover:text-white',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
