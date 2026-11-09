// A keyboard-area panel as a sheet (native plan 06 "Sheet behaviour", shared with 07): resting in
// the keyboard's place, it grows over the chat to 90% of the screen; its handle, or its content
// pulled down at the top, drags it, following the finger; down from rest it slides out and closes.
// One factor, f = grown height ÷ the most it can grow (0 at rest, 1 grown), drives what shows.
// `KeyboardPanelState` (panelState.svelte.ts) keeps it for a panel.

/** Pulled down further than this from its resting height, a panel closes when let go. */
export const CLOSE_PULL = 80;

/** A flick: faster than this, in CSS pixels per millisecond. */
export const FLICK = 0.5;

/** From rest, let go past this f, a panel opens; from open, it stays open past `STAY_OPEN`. */
export const OPEN_FROM_REST = 0.3;
export const STAY_OPEN = 0.7;

/** Grown, a panel is this much of the screen's height, from its bottom. */
export const EXPANDED_SHARE = 0.9;

/** A pull on the content at its top takes the panel once it's gone this far down. */
export const PULL_SLOP = 6;

/** How long after a drag a tap isn't one (a drag ending over a tile or an emoji). */
export const CLICK_GUARD_MS = 300;

/**
 * How far a panel resting at `rest` can grow, `screen` being the screen's height down to the
 * panel's bottom: to `EXPANDED_SHARE` of it.
 */
export function maxGrowFor(screen: number, rest: number): number {
    return Math.max(0, Math.round(screen * EXPANDED_SHARE - rest));
}

/** Where a panel settles: at its resting height, open (grown all the way) or gone. */
export type PanelSpot = "rest" | "open";
export type Settle = PanelSpot | "close";

/** Where a panel is under the finger: grown above its resting height, or pulled down below it. */
export type DragPosition = { grown: number; pulled: number };

/**
 * Where the finger has taken the panel: `from` how much it had grown, moved `dy` (down is
 * positive), no higher than `maxGrow` (0 for a panel that doesn't grow, as on mobile web), and
 * below its resting height pulled down by as much.
 */
export function dragPosition(from: number, dy: number, maxGrow: number): DragPosition {
    const at = from - dy;
    if (at >= 0) return { grown: Math.min(Math.max(maxGrow, 0), at), pulled: 0 };
    return { grown: 0, pulled: -at };
}

/**
 * Where a panel goes when it's let go (`velocity` in px/ms, down positive): pulled down past
 * `CLOSE_PULL` or flicked down from there, it closes; flicked up it opens, flicked down it goes
 * back to rest; otherwise it opens past f 0.3 from rest, and stays open past f 0.7.
 */
export function settle(
    from: PanelSpot,
    at: DragPosition,
    maxGrow: number,
    velocity: number,
): Settle {
    if (at.pulled > 0) return at.pulled > CLOSE_PULL || velocity > FLICK ? "close" : "rest";
    if (maxGrow <= 0) return "rest";
    if (velocity < -FLICK) return "open";
    if (velocity > FLICK) return "rest";
    const f = at.grown / maxGrow;
    return f > (from === "rest" ? OPEN_FROM_REST : STAY_OPEN) ? "open" : "rest";
}

/**
 * A pull on the panel's scrolling content (Recents, the emoji or GIFs): the content scrolls; once
 * it's at its top and the finger has gone `PULL_SLOP` further down, the panel takes the pull
 * (grown, back towards rest; at rest, out). A pull whose first move is up only scrolls.
 * `fromTop`: how far down the finger has gone since the content was at its top.
 */
export function pullTakesPanel(at: {
    firstUp: boolean;
    scrollTop: number;
    fromTop: number;
}): boolean {
    return !at.firstUp && at.scrollTop <= 0 && at.fromTop > PULL_SLOP;
}

/**
 * The backdrop (`--scrim`) over everything above a panel: min(1, 1.4f), taking taps from f 0.02;
 * in a search (the emoji strip on the keyboard, the GIFs grown) fully on and taking them.
 */
export function panelVeil(f: number, searching: boolean): { opacity: number; tappable: boolean } {
    if (searching) return { opacity: 1, tappable: true };
    const opacity = Math.min(1, Math.max(0, f * 1.4));
    return { opacity, tappable: f > 0.02 };
}

/** The emoji search's handle pulled (07): far or fast enough up, grown; down, the search closed. */
export type SearchPull = "expand" | "close" | "stay";

/** How far the emoji search's handle has to go, or a flick, to leave the search. */
export const SEARCH_PULL = 40;

/** Where the emoji search's strip is under the finger: down at 0.6×, up at 0.3×, 24px at most. */
export function searchPullOffset(dy: number): number {
    return dy >= 0 ? dy * 0.6 : Math.max(-24, dy * 0.3);
}

/** The emoji search's handle let go after `dy` at `velocity` (px/ms, down positive). */
export function searchPullEnd(dy: number, velocity: number): SearchPull {
    if (dy < -SEARCH_PULL || velocity < -FLICK) return "expand";
    if (dy > SEARCH_PULL || velocity > FLICK) return "close";
    return "stay";
}

/** A pull on the grown GIF search past this hides the keyboard, and goes on as the panel's drag. */
export const GIF_PULL_HIDES_KEYBOARD = 12;

/** The finger's speed over its last moves (px/ms, down positive), from the last 100ms of them. */
export function flickVelocity(moves: readonly { t: number; y: number }[]): number {
    const last = moves.at(-1);
    if (last === undefined) return 0;
    const first = moves.find((m) => last.t - m.t <= 100) ?? last;
    const dt = last.t - first.t;
    return dt > 0 ? (last.y - first.y) / dt : 0;
}

/**
 * What shows at f (06): the resting content fades out by f 0.4 and takes no touches past 0.05; the
 * expanded content fades in from 0.4 to 0.8 and takes touches from 0.8; the shadow over the chat
 * is .45 × min(1, 3f).
 */
export function panelLayers(f: number): {
    rest: number;
    restLive: boolean;
    expanded: number;
    expandedLive: boolean;
    shadow: number;
} {
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return {
        rest: clamp(1 - f / 0.4),
        restLive: f <= 0.05,
        expanded: clamp((f - 0.4) / 0.4),
        expandedLive: f >= 0.8,
        shadow: 0.45 * clamp(3 * f),
    };
}
