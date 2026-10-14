/**
 * VMAP: where in the content ads go. Pure parsing and timing; fetching a
 * break's tag is the player layer's job.
 */
export type BreakOffset =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'time'; seconds: number }
  | { kind: 'percent'; percent: number }
  | { kind: 'position'; index: number };

export type AdBreakSpec = {
  id: string | null;
  type: 'linear' | 'nonlinear' | 'display';
  offset: BreakOffset;
  /** URL of a VAST tag, or inline VAST XML. */
  source: string | null;
};

const textOf = (el: Element | null | undefined) => el?.textContent?.trim() ?? '';

export function parseOffset(value: string | null | undefined): BreakOffset | null {
  if (!value) return null;
  const v = value.trim();
  if (v === 'start') return { kind: 'start' };
  if (v === 'end') return { kind: 'end' };
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(v);
  if (percent) return { kind: 'percent', percent: Number(percent[1]) };
  const position = /^#(\d+)$/.exec(v);
  if (position) return { kind: 'position', index: Number(position[1]) };
  const clock = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(v);
  if (clock) return { kind: 'time', seconds: Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]) + Number(`0.${clock[4] ?? 0}`) };
  return null;
}

export function parseVmap(xml: string): AdBreakSpec[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];
  const out: AdBreakSpec[] = [];
  for (const el of Array.from(doc.getElementsByTagName('vmap:AdBreak')).concat(Array.from(doc.getElementsByTagName('AdBreak')))) {
    const offset = parseOffset(el.getAttribute('timeOffset'));
    if (!offset) continue;
    const type = (el.getAttribute('breakType') ?? 'linear').split(',')[0]!.trim();
    const data = el.getElementsByTagName('vmap:VASTAdData')[0] ?? el.getElementsByTagName('VASTAdData')[0];
    const uri = el.getElementsByTagName('vmap:AdTagURI')[0] ?? el.getElementsByTagName('AdTagURI')[0];
    const inline = data?.firstElementChild ? new XMLSerializer().serializeToString(data.firstElementChild) : null;
    out.push({
      id: el.getAttribute('breakId'),
      type: type === 'nonlinear' || type === 'display' ? type : 'linear',
      offset,
      source: inline ?? (textOf(uri) || null),
    });
  }
  return out;
}

/** The content time of a break, or `null` when it cannot be placed (percent of unknown duration). */
export function breakTime(offset: BreakOffset, duration: number, contentPositions: readonly number[] = []): number | null {
  switch (offset.kind) {
    case 'start': return 0;
    case 'end': return Number.isFinite(duration) && duration > 0 ? duration : Infinity;
    case 'time': return offset.seconds;
    case 'percent': return duration > 0 && Number.isFinite(duration) ? (offset.percent / 100) * duration : null;
    case 'position': return contentPositions[offset.index - 1] ?? null;
  }
}

/**
 * Given the content position and what already played, the next break due.
 * `seeking` skips breaks the viewer jumped over instead of replaying them all.
 */
export function dueBreaks(
  breaks: readonly AdBreakSpec[], position: number, duration: number, played: ReadonlySet<string>,
): AdBreakSpec[] {
  const due: { spec: AdBreakSpec; at: number }[] = [];
  breaks.forEach((spec, i) => {
    const key = spec.id ?? `#${i}`;
    if (played.has(key) || spec.type !== 'linear') return;
    const at = breakTime(spec.offset, duration);
    if (at === null || at === Infinity || at > position) return;
    due.push({ spec, at });
  });
  return due.sort((a, b) => a.at - b.at).map((d) => d.spec);
}
