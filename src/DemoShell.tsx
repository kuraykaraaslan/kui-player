import { type ReactNode, useEffect, useRef, useState } from "react";
import "./demo-shell.css";
import { useTheme, type ThemePreference } from "./useTheme";

/**
 * DemoShell — the shared demo "theme" for the KUI component family, ported
 * VERBATIM from the KUIviewer demo (topbar + brand + version + theme switcher,
 * collapsible left panel, main stage, bottom status bar).
 *
 * Styled entirely by demo-shell.css (pure CSS + its own theme variables) so the
 * chrome renders identically to the viewer regardless of how the host Tailwind
 * build resolves custom tokens. Dark mode flips via [data-theme="dark"], which
 * useTheme sets on <html>. Each demo (Calendar / Gantt / Player) drops its
 * component into the stage and fills the side panel + status bar.
 */

export type StatusTone = "idle" | "loading" | "ready" | "error";

export interface DemoShellProps {
  /** Brand label, e.g. "KUI Calendar". */
  brand: string;
  /** Version pill, e.g. "v0.0.1". */
  version: string;
  /** Single-letter logo glyph (defaults to "K"). */
  logo?: string;
  /** Optional external link shown on the left of the action group. */
  link?: { href: string; label: string };
  /** GitHub repo URL — rendered as a labelled icon link in the topbar. */
  github?: string;
  /** npm package page URL — rendered as a labelled icon link in the topbar. */
  npm?: string;
  /** Extra topbar action buttons (rendered before the theme switcher). */
  actions?: ReactNode;
  /** Left-panel header title. */
  sidebarTitle?: string;
  /** Left-panel header count badge. */
  sidebarCount?: ReactNode;
  /** Left-panel body content. Omit to hide the panel entirely. */
  sidebar?: ReactNode;
  /** Bottom status bar. */
  status?: { tone?: StatusTone; text?: ReactNode; meta?: ReactNode; right?: ReactNode };
  /** Extra classes for the stage scroll container (e.g. padding / centering). */
  stageClassName?: string;
  /** Stage content — the component being demoed. */
  children: ReactNode;
}

/* ---------- icons (inline so the shell has no asset deps) ---------- */

const SunIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" />
    <path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.93 19.07l1.41-1.41" /><path d="M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const SystemIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const GitHubIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.005 2.045.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);
const NpmIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
  </svg>
);

type ThemeOption = { value: ThemePreference; label: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement };

const SYSTEM_OPTION: ThemeOption = { value: "system", label: "System", Icon: SystemIcon };
const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  SYSTEM_OPTION,
];

/* ---------- theme switcher (viewer markup: .theme-switcher / .theme-menu) ---------- */

function ThemeSwitcher() {
  const { preference, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEME_OPTIONS.find((o) => o.value === preference) ?? SYSTEM_OPTION;
  const CurrentIcon = current.Icon;

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="theme-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Toggle theme"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <CurrentIcon />
        <span className="label">{current.label}</span>
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className="theme-menu" data-open={open} role="menu">
        {THEME_OPTIONS.map(({ value, label, Icon: OptIcon }) => {
          const active = value === preference;
          return (
            <button
              key={value}
              type="button"
              className="theme-item"
              role="menuitemradio"
              aria-checked={active}
              onClick={(e) => {
                e.stopPropagation();
                setTheme(value);
                setOpen(false);
              }}
            >
              <OptIcon />
              <span>{label}</span>
              <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

export default function DemoShell({
  brand,
  version,
  logo = "K",
  link,
  github,
  npm,
  actions,
  sidebarTitle = "Demo",
  sidebarCount,
  sidebar,
  status,
  stageClassName = "",
  children,
}: DemoShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasSidebar = sidebar != null;
  const tone = status?.tone ?? "idle";

  const shellClass = [
    "shell",
    "demo-shell",
    !hasSidebar ? "no-left" : collapsed ? "left-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <span className="logo">{logo}</span>
          <span>{brand}</span>
          <span className="version">{version}</span>
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          {link && (
            <a className="btn ghost" href={link.href} target="_blank" rel="noopener noreferrer" title={link.label}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {link.label}
            </a>
          )}
          {github && (
            <a className="btn ghost" href={github} target="_blank" rel="noopener noreferrer" title="GitHub repository">
              <GitHubIcon />
              GitHub
            </a>
          )}
          {npm && (
            <a className="btn ghost" href={npm} target="_blank" rel="noopener noreferrer" title="npm package">
              <NpmIcon />
              npm
            </a>
          )}
          {actions}
          <ThemeSwitcher />
        </div>
      </header>

      {/* Left panel */}
      {hasSidebar && (
        <aside className={`panel left${collapsed ? " collapsed" : ""}`}>
          <div className="panel-header">
            <span className="title-text">{sidebarTitle}</span>
            {sidebarCount != null && <span className="count">{sidebarCount}</span>}
            <span className="spacer" />
            <button
              type="button"
              className="collapse-btn"
              title={collapsed ? "Expand panel" : "Collapse panel"}
              aria-label="Toggle panel"
              onClick={() => setCollapsed((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
          <div className="panel-body">{sidebar}</div>
        </aside>
      )}

      {/* Stage */}
      <main className={`stage ${stageClassName}`}>{children}</main>

      {/* Bottom status bar */}
      <footer className={`bottombar ${tone}`}>
        <span className="dot" />
        <span>{status?.text ?? "Ready"}</span>
        {status?.meta != null && (
          <>
            <span className="sep" />
            <span>{status.meta}</span>
          </>
        )}
        <div className="right-info">
          {status?.right}
          {status?.right != null && <span className="sep" />}
          <span>{brand} · demo</span>
        </div>
      </footer>
    </div>
  );
}
