// Where the app's toasts and the achievement toast play (web/00, updated 2026-11-12): docked at the
// foot of the middle panel, just above its composer (and above any popup the composer has open:
// its + menu, mention list or emoji picker), or just above the panel's bottom where it has no
// composer (Explore, the wallet, a list with nothing selected), centred on the panel. The
// achievement stacks above the toasts on the same centre line while one shows, so neither ever
// covers the composer, its popups or the other.
//
// The middle panel's foot, not the right column's: web/00 docks a toast at the foot of the panel
// whose content changed, but the app's toasts (toastStore) don't say which panel raised them
// (GAPS: Toasts). With the middle panel hidden (the narrow layout showing the list) both play
// centred at the window's bottom instead, where the toasts were before. Either way they stay on
// screen: a window smaller than the shell's minimum scrolls the shell (Shell's frame), and the
// panel's foot may then be below or beside what shows.

/** A box on the window, in CSS pixels from its top left (a `getBoundingClientRect`). */
export type Box = { left: number; top: number; width: number; height: number };

/** The window's size, in CSS pixels, and its bottom safe area (a home indicator's). */
export type WindowSize = { width: number; height: number; safeBottom: number };

/**
 * Where the toasts sit: across `left` to `left + width` (they're centred in it), their bottom edge
 * at `y`, in CSS pixels from the window's top left. They grow up from there.
 */
export type ToastSpot = { left: number; width: number; y: number };

/**
 * Where the achievement toast sits: `x` is its centre and `y` its bottom edge, in CSS pixels from
 * the window's top left (the toast grows up from there, its confetti above it).
 */
export type AchievementSpot = { x: number; y: number };

/** The room between a toast and what it sits on: the composer, the panel's bottom, a toast. */
export const BOTTOM_GAP = 12;

/** With no middle panel showing, how far over the window's bottom (its safe area) they sit. */
export const WINDOW_INSET = 24;

/** The achievement toast's card (the library's `AchievementToast`, a fixed 64px; its confetti
 * spills over the window freely). */
export const ACHIEVEMENT_HEIGHT = 64;

/** Keeps something `height` tall whose bottom edge is at `y` from going over the window's top: in
 * a short window with a tall popup open there may be no room above, and then it's better whole
 * and over what's under it than cut off. */
function belowTop(y: number, height: number): number {
    return Math.max(y, height + BOTTOM_GAP);
}

function shown(box: Box | undefined): box is Box {
    return box !== undefined && box.width > 0 && box.height > 0;
}

/**
 * Where the app's toasts sit, given the middle panel and the composer in it, each if it's there.
 *
 * - `middle`: the middle panel. Hidden (a narrow layout showing the list), or scrolled out of
 *   view, the toasts sit centred on the window, `WINDOW_INSET` over its bottom safe area.
 * - `composer`: the middle panel's own composer, if it has one showing.
 * - `popups`: what the composer has open above it, which they sit above too.
 * - `height`: how tall the toasts are (their layer), so they're kept below the window's top.
 */
export function toastSpot(
    window: WindowSize,
    middle: Box | undefined,
    composer: Box | undefined,
    popups: Box[] = [],
    height = 0,
): ToastSpot {
    const bottom = window.height - window.safeBottom;
    // the part of the panel across the window
    const left = shown(middle) ? Math.max(middle.left, 0) : 0;
    const right = shown(middle) ? Math.min(middle.left + middle.width, window.width) : 0;
    if (!shown(middle) || right <= left) {
        return { left: 0, width: window.width, y: belowTop(bottom - WINDOW_INSET, height) };
    }
    const floor = shown(composer)
        ? Math.min(composer.top, ...popups.filter(shown).map((p) => p.top))
        : middle.top + middle.height;
    return { left, width: right - left, y: belowTop(Math.min(floor, bottom) - BOTTOM_GAP, height) };
}

/**
 * Where the achievement toast sits: where the toasts do (`toastSpot`), or, while one shows, above
 * them on the same centre line.
 *
 * - `toasts`: how tall the app's toasts are while one shows (their layer: one, or two one above
 *   the other), else undefined or 0.
 */
export function achievementSpot(
    window: WindowSize,
    middle: Box | undefined,
    composer: Box | undefined,
    popups: Box[],
    toasts: number | undefined,
): AchievementSpot {
    const spot = toastSpot(window, middle, composer, popups, toasts ?? 0);
    const y = toasts !== undefined && toasts > 0 ? spot.y - toasts - BOTTOM_GAP : spot.y;
    return { x: spot.left + spot.width / 2, y: belowTop(y, ACHIEVEMENT_HEIGHT) };
}
