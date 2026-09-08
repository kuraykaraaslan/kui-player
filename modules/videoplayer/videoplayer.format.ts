/** Cached per locale — constructing an `Intl.NumberFormat` is not cheap. */
const numberFormats = new Map<string, Intl.NumberFormat>();

function digits(value: number, pad: number, locale?: string): string {
  if (!locale || locale === 'en') return String(value).padStart(pad, '0');
  let format = numberFormats.get(`${locale}:${pad}`);
  if (!format) {
    format = new Intl.NumberFormat(locale, { minimumIntegerDigits: pad, useGrouping: false });
    numberFormats.set(`${locale}:${pad}`, format);
  }
  return format.format(value);
}

/**
 * `m:ss`, or `h:mm:ss` past an hour. Truncates rather than rounds, so the clock
 * never shows a second the viewer has not reached.
 *
 * Pass a BCP-47 tag to render the digits in that locale's numbering system —
 * Arabic-Indic numerals for `ar`, for instance.
 */
export function formatTime(seconds: number, locale?: string): string {
  if (!isFinite(seconds) || isNaN(seconds)) return `${digits(0, 1, locale)}:${digits(0, 2, locale)}`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${digits(h, 1, locale)}:${digits(m, 2, locale)}:${digits(s, 2, locale)}`;
  return `${digits(m, 1, locale)}:${digits(s, 2, locale)}`;
}
