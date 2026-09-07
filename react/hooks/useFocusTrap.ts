import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusable(root: HTMLElement): HTMLElement[] {
  // Availability, not geometry: layout-based visibility checks are unreliable
  // (and always false without a layout engine), while these attributes are
  // exactly what makes a control unreachable.
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled')
      && el.getAttribute('aria-hidden') !== 'true'
      && !el.closest('[hidden], [aria-hidden="true"]'),
  );
}

/**
 * Hold keyboard focus inside `ref` while `active`, and put it back where it was
 * on the way out. Without this, tabbing out of the settings menu lands on the
 * page behind a still-open dialog — and the viewer has no way back.
 *
 * Resolves the active element through the node's root so it also works inside a
 * shadow root (skin mode), where `document.activeElement` is only the host.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
): void {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;

    const scope = root.getRootNode() as Document | ShadowRoot;
    const previous = scope.activeElement as HTMLElement | null;

    // Focus the first control rather than the container, so the first Tab moves
    // to the second control instead of into the middle of the list.
    const first = focusable(root)[0];
    (first ?? root).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) { e.preventDefault(); e.stopPropagation(); onEscape(); return; }
      if (e.key !== 'Tab') return;
      const items = focusable(root);
      if (items.length === 0) { e.preventDefault(); return; }
      const current = scope.activeElement as HTMLElement | null;
      const index = current ? items.indexOf(current) : -1;
      const next = e.shiftKey
        ? items[index <= 0 ? items.length - 1 : index - 1]
        : items[index === items.length - 1 || index === -1 ? 0 : index + 1];
      e.preventDefault();
      next?.focus({ preventScroll: true });
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // Only reclaim focus if it is still inside what we are unmounting.
      const current = scope.activeElement as HTMLElement | null;
      if (previous && (!current || current === document.body || root.contains(current))) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [ref, active, onEscape]);
}
