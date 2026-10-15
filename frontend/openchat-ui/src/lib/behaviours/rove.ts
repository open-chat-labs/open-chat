// Roving focus for composite widgets: arrows (or Home/End) move focus between the
// container's `selector` items, skipping aria-disabled ones. Horizontal lists are RTL-aware.
// Returns the newly focused element, or null when the key isn't a navigation key.
export function rove(e: KeyboardEvent & { currentTarget: HTMLElement }, selector: string, orient: 'h' | 'v'): HTMLElement | null {
  const keys = orient === 'h' ? { next: 'ArrowRight', prev: 'ArrowLeft' } : { next: 'ArrowDown', prev: 'ArrowUp' };
  if (![keys.next, keys.prev, 'Home', 'End'].includes(e.key)) return null;
  const els = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getAttribute('aria-disabled') !== 'true');
  if (!els.length) return null;
  let i = els.indexOf(document.activeElement?.closest<HTMLElement>(selector) as HTMLElement);
  const rtl = orient === 'h' && getComputedStyle(e.currentTarget).direction === 'rtl';
  const fwd = (e.key === keys.next) !== rtl;
  i = e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : i < 0 ? (fwd ? 0 : els.length - 1) : (i + (fwd ? 1 : -1) + els.length) % els.length;
  e.preventDefault();
  els[i].focus();
  return els[i];
}
