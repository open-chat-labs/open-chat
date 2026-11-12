// Where the achievement toast plays (web/00 and web/13, updated 2026-11-12): just above the
// composer, centred in the middle panel, or just above the middle panel's bottom where it has no
// composer (Explore, the wallet, a list with nothing selected). It never overlaps the app's
// toasts: while one shows, the achievement sits above it, so both stay readable.

/** A box on the window, in CSS pixels from its top left (a `getBoundingClientRect`). */
export type Box = { left: number; top: number; width: number; height: number };

/** The window's size, in CSS pixels. */
export type WindowSize = { width: number; height: number };

/**
 * Where the toast sits: `x` is its centre and `y` its bottom edge, in CSS pixels from the
 * window's top left (the toast grows up from there, its confetti above it).
 */
export type AchievementSpot = { x: number; y: number };

/** The room between the toast and what it sits on: the composer, the panel's bottom, a toast. */
export const ACHIEVEMENT_GAP = 12;

function shown(box: Box | undefined): box is Box {
    return box !== undefined && box.width > 0 && box.height > 0;
}

/**
 * Where the achievement toast sits, given the middle panel, the composer in it and the app's
 * toast layer, each if it's there.
 *
 * - `middle`: the middle panel. Hidden (a narrow layout showing the list), the window stands in
 *   for it.
 * - `composer`: the middle panel's composer, if it has one showing.
 * - `toasts`: the app's toasts, while one shows (their layer, from the top of the highest).
 */
export function achievementSpot(
    window: WindowSize,
    middle: Box | undefined,
    composer: Box | undefined,
    toasts: Box | undefined,
): AchievementSpot {
    const panel: Box = shown(middle)
        ? middle
        : { left: 0, top: 0, width: window.width, height: window.height };
    const floor = shown(composer) ? composer.top : panel.top + panel.height;
    const y = shown(toasts)
        ? Math.min(floor, toasts.top) - ACHIEVEMENT_GAP
        : floor - ACHIEVEMENT_GAP;
    return { x: panel.left + panel.width / 2, y };
}
