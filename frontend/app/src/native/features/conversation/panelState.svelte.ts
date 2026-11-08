import {
    dragPosition,
    flickVelocity,
    settle,
    type DragPosition,
    type PanelSpot,
    type Settle,
} from "./panelDrag";

/**
 * A keyboard-area panel's height as its handle is dragged (panelDrag.ts): at rest, open (grown up
 * to the status bar) or, under the finger, wherever the finger has it, 1:1. The panel's surface
 * (KeyboardPanel) works out how far it can grow (`measuredBy`, run as a drag starts or it expands)
 * and closes the slot when a drag ends in "close".
 */
export class KeyboardPanelState {
    #spot = $state<PanelSpot>("rest");
    #drag = $state<DragPosition | undefined>();
    #maxGrow = $state(0);
    #closing = $state(false);
    #start: { y: number; grown: number; spot: PanelSpot } | undefined;
    #moves: { t: number; y: number }[] = [];
    #measure: (() => void) | undefined;

    /** It grows (not on mobile web's attach panel). */
    readonly expandable: boolean;

    constructor(expandable: boolean) {
        this.expandable = expandable;
    }

    /** How far it has grown above its resting height, in CSS pixels. */
    get grown(): number {
        if (this.#drag !== undefined) return this.#drag.grown;
        return this.#spot === "open" ? this.#maxGrow : 0;
    }

    /** How far it's pulled down below its resting height. */
    get pulled(): number {
        return this.#drag?.pulled ?? 0;
    }

    /** f: how far it has grown, 0 at rest to 1 open. */
    get f(): number {
        return this.#maxGrow > 0 ? this.grown / this.#maxGrow : 0;
    }

    /** A finger has it: it follows without animating. */
    get dragging(): boolean {
        return this.#drag !== undefined;
    }

    /** It's open (or settling there). */
    get open(): boolean {
        return this.#spot === "open";
    }

    /** It's sliding out after a drag down, to close. */
    get closing(): boolean {
        return this.#closing;
    }

    setMaxGrow(px: number): void {
        const max = this.expandable ? Math.max(0, Math.round(px)) : 0;
        if (max !== this.#maxGrow) this.#maxGrow = max;
    }

    /** What works out how far it can grow (`setMaxGrow`), for a drag or an expand to run first. */
    measuredBy(measure: (() => void) | undefined): void {
        this.#measure = measure;
    }

    /** Works out how far it can grow, now. */
    measure(): void {
        this.#measure?.();
    }

    /** Grows it all the way (All photos, the emoji search). */
    expand(): void {
        if (!this.expandable) return;
        this.measure();
        this.#spot = "open";
    }

    /** Back to its resting height (Recents' chevron). */
    rest(): void {
        this.#spot = "rest";
    }

    /** Back to rest, at once: another panel takes the slot, or it opens again. */
    reset(): void {
        this.#spot = "rest";
        this.#drag = undefined;
        this.#closing = false;
        this.#start = undefined;
    }

    dragStart(y: number, t: number): void {
        if (this.#closing) return;
        this.measure();
        this.#start = { y, grown: this.grown, spot: this.#spot };
        this.#moves = [{ t, y }];
        this.#drag = { grown: this.grown, pulled: 0 };
    }

    dragMove(y: number, t: number): void {
        const start = this.#start;
        if (start === undefined) return;
        this.#moves.push({ t, y });
        if (this.#moves.length > 12) this.#moves.shift();
        this.#drag = dragPosition(start.grown, y - start.y, this.#maxGrow);
    }

    /** The finger's off: where the panel settles ("close": the host slides it out and closes it). */
    dragEnd(t: number): Settle | undefined {
        const start = this.#start;
        const at = this.#drag;
        this.#start = undefined;
        if (start === undefined || at === undefined) return undefined;
        const last = this.#moves.at(-1);
        if (last !== undefined && t - last.t > 100) this.#moves = [];
        const where = settle(start.spot, at, this.#maxGrow, flickVelocity(this.#moves));
        this.#drag = undefined;
        if (where === "close") {
            this.#spot = "rest";
            this.#closing = true;
        } else {
            this.#spot = where;
        }
        return where;
    }
}
