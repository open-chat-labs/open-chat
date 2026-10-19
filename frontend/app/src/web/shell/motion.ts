// The right column's motion (Shell.svelte): docked, or as a modal sheet over a fading scrim, it
// slides in from the inline end.

/** --duration-slow's fallback, in ms. */
export const SLOW = 280;

/**
 * A duration token's value in ms (`280ms`, `0.28s`, or a bare number of ms), and SLOW for one
 * that's missing or unreadable. 0 stays 0: a theme can turn the motion off.
 */
export function tokenDuration(token: string): number {
    const value = token.trim();
    const n = Number.parseFloat(value);
    if (Number.isNaN(n)) return SLOW;
    return value.endsWith("s") && !value.endsWith("ms") ? n * 1000 : n;
}

/** The docked column or the sheet, in from the inline end: the left in a right-to-left page. */
export function slideCss(rtl: boolean): (t: number, u: number) => string {
    const sign = rtl ? -1 : 1;
    return (_t, u) => `transform: translateX(${sign * u * 100}%)`;
}

export function fadeCss(t: number): string {
    return `opacity: ${t}`;
}
