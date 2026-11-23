// The Communities tab's switcher (native plan 12 "Switcher: strip ↔ sheet", Design Notes §3.8): one
// surface at the bottom of the tab, collapsed to the strip of community avatars, grown into the
// sheet of the user's communities. Everything on it follows one factor, f = (height − collapsed) ÷
// (max − collapsed), 0 at the strip and 1 at the sheet: the strip's row fades out over f 0 → 0.4,
// the sheet's search, list and Explore / Create fade in over 0.4 → 0.8, and its fill, corners,
// shadow and the dim behind it follow f. A drag follows the finger; letting go settles it at the
// strip or the sheet by a flick, a quick drag or where it is. Pure, so the screen only feeds it
// pointer positions and heights.

/** The strip's height (the design's 84px: the handle and the row of 42px avatars). */
export const COLLAPSED_HEIGHT = 84;
/** How far below the screen's top the sheet stops (the design's 118px). */
export const SHEET_TOP = 118;
/** The sheet is at least this much taller than the strip, on the smallest screen. */
export const MIN_GROWTH = 200;

/** A release faster than this (px/ms) is a flick, which settles the way it was going. */
export const FLICK_VELOCITY = 0.45;
/** A drag this far (px) … */
export const QUICK_DISTANCE = 56;
/** … within this long (ms) is a quick drag, which settles the way it was going. */
export const QUICK_MS = 260;
/** A press moving less than this (px) is still a tap, not a drag. */
export const DRAG_SLOP = 4;

/** How long the settling takes from one end to the other (ms): less for a shorter way. */
export const SETTLE_MS = 380;
/** The shortest settle, as a share of SETTLE_MS. */
const MIN_SETTLE_SHARE = 0.35;

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

/** The sheet's tallest: the screen's height less SHEET_TOP, never less than MIN_GROWTH over the strip. */
export function maxHeight(screenHeight: number): number {
    return Math.max(COLLAPSED_HEIGHT + MIN_GROWTH, screenHeight - SHEET_TOP);
}

/** f for a surface `height` px tall: 0 at the strip, 1 at the sheet. */
export function factorFor(height: number, max: number): number {
    return clamp01((height - COLLAPSED_HEIGHT) / (max - COLLAPSED_HEIGHT));
}

/** The surface's height at `f`. */
export function heightFor(f: number, max: number): number {
    return COLLAPSED_HEIGHT + (max - COLLAPSED_HEIGHT) * clamp01(f);
}

/** 0 before `from`, 1 after `to`, and in between in proportion. */
export function ramp(f: number, from: number, to: number): number {
    return clamp01((f - from) / (to - from));
}

/** What shows at `f`: each part's opacity, and how the surface looks. */
export type SwitcherLook = {
    /** The strip's row of avatars: out over f 0 → 0.4. */
    strip: number;
    /** The sheet's search, list and Explore / Create: in over f 0.4 → 0.8. */
    sheet: number;
    /** The sheet's raised fill over the page colour. */
    fill: number;
    /** The top corners' radius (px): 10 at the strip, 22 at the sheet. */
    radius: number;
    /** The shadow's strength. */
    shadow: number;
    /** The dim behind the sheet. */
    dim: number;
};

export function lookAt(f: number): SwitcherLook {
    const at = clamp01(f);
    return {
        strip: 1 - ramp(at, 0, 0.4),
        sheet: ramp(at, 0.4, 0.8),
        fill: at,
        radius: 10 + 12 * at,
        shadow: 0.45 * at,
        dim: at,
    };
}

/** Whether the surface counts as the sheet (open): past halfway. */
export function isOpen(f: number): boolean {
    return f > 0.5;
}

/** f while dragged: where it started, moved by the finger (up grows it) over the surface's range. */
export function dragFactor(startF: number, dy: number, max: number): number {
    return clamp01(startF - dy / (max - COLLAPSED_HEIGHT));
}

/** A pointer's position along the drag, with when (ms). */
export type DragSample = { t: number; y: number };

/** How fast the finger was moving as it let go (px/ms, down positive): over the samples kept. */
export function releaseVelocity(samples: readonly DragSample[]): number {
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    return (last.y - first.y) / Math.max(1, last.t - first.t);
}

/** How many recent samples a drag keeps for its release velocity. */
export const KEPT_SAMPLES = 6;

/** The drag's samples with `next`, the last KEPT_SAMPLES of them. */
export function withSample(samples: readonly DragSample[], next: DragSample): DragSample[] {
    return [...samples, next].slice(-KEPT_SAMPLES);
}

/**
 * Where letting go settles: 1 (the sheet) or 0 (the strip). A flick goes the way it was going; so
 * does a quick drag (QUICK_DISTANCE within QUICK_MS); otherwise past halfway is the sheet.
 */
export function releaseTarget(release: {
    /** px/ms, down positive. */
    velocity: number;
    /** How long the drag took (ms). */
    elapsed: number;
    /** How far it went (px, down positive). */
    distance: number;
    /** f as it's let go. */
    f: number;
}): 0 | 1 {
    const { velocity, elapsed, distance, f } = release;
    if (Math.abs(velocity) > FLICK_VELOCITY) return velocity < 0 ? 1 : 0;
    if (elapsed < QUICK_MS && Math.abs(distance) > QUICK_DISTANCE) return distance < 0 ? 1 : 0;
    return isOpen(f) ? 1 : 0;
}

/** How long settling from `from` to `to` takes (ms). */
export function settleDuration(from: number, to: number): number {
    return SETTLE_MS * Math.max(MIN_SETTLE_SHARE, Math.abs(to - from));
}

/** f along a settle `elapsed` ms into one of `duration` ms (an ease-out). */
export function settleAt(from: number, to: number, elapsed: number, duration: number): number {
    const k = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    return from + (to - from) * eased;
}

// ---- the sheet's rows, dragged into a new order

/** A sheet row's height and the gap under it (px): 58px rows, 12px apart. */
export const ROW_PITCH = 58 + 12;

/** The index a row dragged from `from` by `dy` px lands at, among `count` rows. */
export function dropIndex(from: number, dy: number, count: number): number {
    const to = from + Math.round(dy / ROW_PITCH);
    return Math.max(0, Math.min(count - 1, to));
}

/** `items` with the one at `from` moved to `to`. */
export function moved<T>(items: readonly T[], from: number, to: number): T[] {
    const next = [...items];
    if (from === to || from < 0 || from >= next.length) return next;
    const [item] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
    return next;
}

/**
 * Where each row shows while one is dragged (px down from its place): the dragged one under the
 * finger, the ones it has passed moved a row the other way to make room.
 */
export function rowShift(index: number, from: number, dy: number, count: number): number {
    if (index === from) return dy;
    const to = dropIndex(from, dy, count);
    if (from < to && index > from && index <= to) return -ROW_PITCH;
    if (to < from && index >= to && index < from) return ROW_PITCH;
    return 0;
}
