import { createContext, useContext, type ReactNode } from 'react';

/**
 * The player's whole icon set, inline. Fifteen-odd glyphs is not worth four
 * runtime packages — this file replaces the FontAwesome dependency chain and
 * costs about a kilobyte.
 *
 * Every icon is a 24×24 `currentColor` SVG sized in `em`, so the same font-size
 * utilities that sized the old icon font still work. Geometry follows the
 * Material Symbols shapes (Apache-2.0), which match this project's licence.
 */

export type IconName =
  | 'play' | 'pause' | 'replay' | 'forward'
  | 'volumeHigh' | 'volumeLow' | 'volumeOff'
  | 'expand' | 'compress' | 'settings' | 'pip' | 'cast'
  | 'chevronLeft' | 'chevronRight' | 'check' | 'close'
  | 'spinner' | 'alert' | 'retry'
  | 'skipBack' | 'skipForward' | 'brightness'
  | 'globe' | 'linkedin' | 'npm';

/** Replace any icon with your own node: `icons={{ play: <MyPlay /> }}`. */
export type IconOverrides = Partial<Record<IconName, ReactNode>>;

const IconOverrideContext = createContext<IconOverrides>({});

export function IconProvider({ value, children }: { value: IconOverrides; children: ReactNode }) {
  return <IconOverrideContext.Provider value={value}>{children}</IconOverrideContext.Provider>;
}

type SvgProps = { className?: string; children: ReactNode; stroke?: boolean };

function Svg({ className, children, stroke = false }: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...(stroke
        ? { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
        : { fill: 'currentColor' })}
    >
      {children}
    </svg>
  );
}

const PATHS: Record<Exclude<IconName, 'spinner' | 'brightness'>, string> = {
  play: 'M8 5.14v13.72L19 12z',
  pause: 'M6.5 4.5h3.6v15H6.5zm7.4 0h3.6v15h-3.6z',
  // "replay 10": a counter-clockwise loop; `forward` is the same glyph mirrored.
  replay: 'M12 5V1.5L7.5 6l4.5 4.5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
  forward: 'M12 5V1.5L16.5 6 12 10.5V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z',
  volumeHigh: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.47 4.47 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z',
  volumeLow: 'M5 9v6h4l5 5V4L9 9H5zm11.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.47 4.47 0 0 0 16.5 12z',
  volumeOff: 'M4.34 2.93 2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.65.49-1.38.88-2.18 1.11v2.06a8.9 8.9 0 0 0 3.61-1.75l2.05 2.05 1.41-1.41L4.34 2.93zM12 4 9.91 6.09 12 8.18V4zm4.5 8c0-1.77-1.02-3.29-2.5-4.03v1.79l2.48 2.48c.01-.08.02-.16.02-.24z',
  expand: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  compress: 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z',
  pip: 'M19 11h-8v6h8v-6zm2-8H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16.02H3V4.98h18v14.04z',
  cast: 'M1 18v3h3a3 3 0 0 0-3-3zm0-4v2a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7zm0-4v2a9 9 0 0 1 9 9h2A11 11 0 0 0 1 10zm20-7H3a2 2 0 0 0-2 2v3h2V5h18v14h-7v2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
  chevronLeft: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z',
  chevronRight: 'M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  alert: 'M12 3 1.5 21h21L12 3zm1 13.5h-2v2h2v-2zm0-7h-2v5h2v-5z',
  retry: 'M17.65 6.35A8 8 0 1 0 19.73 14h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3l-3.35 3.35z',
  skipBack: 'M11 18V6l-8.5 6zm9 0V6l-8.5 6z',
  skipForward: 'M4 18l8.5-6L4 6zm9 0 8.5-6L13 6z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14A7.8 7.8 0 0 1 4 12c0-.69.1-1.36.26-2h3.38a16.5 16.5 0 0 0 0 4H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82A13.9 13.9 0 0 1 12 19.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3V9zm7 0h3.8v1.71h.05a4.17 4.17 0 0 1 3.75-2.06c4.01 0 4.75 2.64 4.75 6.07V21h-4v-5.5c0-1.31-.02-3-1.83-3-1.83 0-2.11 1.43-2.11 2.9V21h-4V9z',
  npm: 'M2 4v16h9.33v-2.67H16V20h6V4H2zm2.67 2.67h4V16H6.67V9.33H5.33V16H4.67V6.67zm5.33 0h4V16h-2.67V9.33h-1.33V16h-.67V6.67h.67zm5.33 0h4V16h-1.33V9.33h-1.33V16h-1.34V6.67z',
};

/** The one animated glyph — rotation comes from the `kui-spin` class. */
function Spinner({ className }: { className?: string }) {
  return (
    <Svg className={className} stroke>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </Svg>
  );
}

function Brightness({ className }: { className?: string }) {
  return (
    <Svg className={className} stroke>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </Svg>
  );
}

/**
 * Renders `name`, unless the consumer supplied a replacement for it through
 * `IconProvider` — which is how `icons={{ play: <MyIcon/> }}` reaches here.
 */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  const override = useContext(IconOverrideContext)[name];
  if (override !== undefined) return <>{override}</>;
  if (name === 'spinner') return <Spinner className={className} />;
  if (name === 'brightness') return <Brightness className={className} />;
  return <Svg className={className}><path d={PATHS[name]} /></Svg>;
}
