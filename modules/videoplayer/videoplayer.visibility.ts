/**
 * Whether anyone can see an element: in the viewport and in a visible tab.
 *
 * `onChange` fires only when the combined answer changes. Without
 * `IntersectionObserver` (very old browsers, some test environments) only tab
 * visibility is followed, which errs towards "visible" — the safe side.
 */
export function watchVisibility(
  el: Element,
  onChange: (visible: boolean) => void,
  doc: Document = el.ownerDocument,
): () => void {
  let inView = true;
  let last = true;
  const evaluate = () => {
    const visible = inView && !doc.hidden;
    if (visible === last) return;
    last = visible;
    onChange(visible);
  };

  const onVisibility = () => evaluate();
  doc.addEventListener('visibilitychange', onVisibility);

  let observer: IntersectionObserver | null = null;
  const View = (doc.defaultView as (Window & typeof globalThis) | null)?.IntersectionObserver
    ?? (typeof IntersectionObserver === 'undefined' ? undefined : IntersectionObserver);
  if (View) {
    observer = new View((entries) => {
      // Several entries may be queued; the last one is the current truth.
      const entry = entries[entries.length - 1];
      if (!entry) return;
      inView = entry.isIntersecting;
      evaluate();
    }, { threshold: 0 });
    observer.observe(el);
  }

  // A tab that is already hidden when watching starts must not wait for an event.
  evaluate();

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    observer?.disconnect();
  };
}
