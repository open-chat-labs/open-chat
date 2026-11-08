// Dragging a keyboard-area panel by its handle (native plan 06 "Opening, closing, switching" and
// "Expanded", 07 "Opening, closing, switching"): up, it grows over the chat towards the status
// bar, following the finger; down from its resting height, it's pulled out and closes. One factor,
// f = grown height ÷ the most it can grow (0 at rest, 1 open), drives what shows.
// `KeyboardPanelState` (panelState.svelte.ts) keeps it for a panel.

/** Pulled down further than this from its resting height, a panel closes when let go. */
export const CLOSE_PULL = 80;

/** A flick: faster than this, in CSS pixels per millisecond. */
export const FLICK = 0.5;

/** From rest, let go past this f, a panel opens; from open, it stays open past `STAY_OPEN`. */
export const OPEN_FROM_REST = 0.3;
export const STAY_OPEN = 0.7;

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
 * A pull on a grown panel's scrolling content (Recents, the emoji or GIFs): the content scrolls
 * until it's at its top; from there a finger moving down drags the panel instead, within the same
 * gesture (and it keeps the panel till the finger's off). At rest the content only scrolls.
 */
export function pullTakesPanel(at: { open: boolean; scrollTop: number; dy: number }): boolean {
    return at.open && at.scrollTop <= 0 && at.dy > 0;
}

/** The finger's speed over its last moves (px/ms, down positive), from the last 100ms of them. */
export function flickVelocity(moves: readonly { t: number; y: number }[]): number {
    const last = moves.at(-1);
    if (last === undefined) return 0;
    const first = moves.find((m) => last.t - m.t <= 100) ?? last;
    const dt = last.t - first.t;
    return dt > 0 ? (last.y - first.y) / dt : 0;
}

/**
 * What shows at f (06 "Expanded"): the resting content fades out by f 0.4 and takes no touches
 * past 0.05; the expanded content fades in from 0.4 to 0.8 and takes touches from 0.8; the shadow
 * over the chat strengthens with f.
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
        shadow: 0.45 * clamp(f),
    };
}
