export type ClassValue = string | number | null | undefined | false | ClassValue[];

/**
 * Join class names, dropping anything falsy. That is the whole job now that the
 * player ships its own scoped stylesheet — there are no utility classes left to
 * de-duplicate, so `clsx` + `tailwind-merge` are gone with it.
 */
export function cn(...inputs: ClassValue[]): string {
  let out = '';
  for (const input of inputs) {
    if (!input) continue;
    const part = Array.isArray(input) ? cn(...input) : String(input);
    if (part) out += out ? ` ${part}` : part;
  }
  return out;
}
