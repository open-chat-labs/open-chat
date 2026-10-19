// The right column's motion (Shell.svelte): docked, it grows from the inline end and pushes the
// middle over; as a modal, the sheet slides in over a fading scrim.

/** --duration-slow's fallback, in ms. */
export const SLOW = 280;

/**
 * How long the column's motion runs, in ms: none for a window crossing the docking width (one
 * form swaps for the other) or with reduced motion, else the `--duration-slow` token.
 */
export function motionDuration(still: boolean, token: string): number {
    if (still) return 0;
    return Number.parseFloat(token) || SLOW;
}

/** The docked column's width, from nothing (its content keeps the full width meanwhile). */
export function growCss(width: number): (t: number) => string {
    return (t) => `width: ${t * width}px`;
}

/** The sheet, in from the inline end: the left in a right-to-left page. */
export function slideCss(rtl: boolean): (t: number, u: number) => string {
    const sign = rtl ? -1 : 1;
    return (_t, u) => `transform: translateX(${sign * u * 100}%)`;
}

export function fadeCss(t: number): string {
    return `opacity: ${t}`;
}
