import type { Search } from "./keyboardSlot";
import {
    CLICK_GUARD_MS,
    dragPosition,
    flickVelocity,
    panelVeil,
    pullTakesPanel,
    searchPullEnd,
    searchPullOffset,
    settle,
    type DragPosition,
    type PanelSpot,
    type SearchPull,
    type Settle,
} from "./panelDrag";

/** How a search is left from the sheet: to rest (the backdrop), grown (pulled up), or closed. */
export type SearchLeave = "rest" | Exclude<SearchPull, "stay">;

/**
 * A keyboard-area panel as a sheet (panelDrag.ts): at rest, open (grown to 90% of the screen) or,
 * under the finger, wherever the finger has it, 1:1; in the emoji search, its strip pulled by its
 * own rules. The panel's surface (KeyboardPanel) works out how far it can grow (`measuredBy`, run
 * as a drag starts or it expands) and closes the slot when a drag ends in "close"; the emoji panel
 * hears a search left from the sheet (`onLeaveSearch`).
 */
export class KeyboardPanelState {
    #spot = $state<PanelSpot>("rest");
    #drag = $state<DragPosition | undefined>();
    #maxGrow = $state(0);
    #closing = $state(false);
    #start: { y: number; grown: number; spot: PanelSpot } | undefined;
    #moves: { t: number; y: number }[] = [];
    #measure: (() => void) | undefined;
    // a pull on the content: where the content was last at its top, the finger's last place,
    // which way it first went, and whether the panel has taken it
    #pull:
        | {
              top: number;
              y: number;
              atTop: boolean | undefined;
              firstUp: boolean | undefined;
              taken: boolean;
          }
        | undefined;
    #search = $state<Search>("none");
    // the emoji search's strip under the finger
    #searchDy = $state<number | undefined>();
    // when the last drag that moved ended, for the taps it would otherwise make
    #lastDragEnd = -Infinity;
    #moved = false;

    /** A search left from the sheet (the backdrop, the strip's handle pulled). */
    onLeaveSearch: ((how: SearchLeave) => void) | undefined;

    #expandable = $state(false);

    constructor(expandable: boolean) {
        this.#expandable = expandable;
    }

    /** It grows (not on mobile web's attach panel, nor while the emoji search's strip shows). */
    get expandable(): boolean {
        return this.#expandable;
    }

    /** It grows, or (back at rest) doesn't, from now. */
    setExpandable(expandable: boolean): void {
        this.#expandable = expandable;
        if (!expandable) {
            this.#spot = "rest";
            this.#maxGrow = 0;
        } else {
            this.measure();
        }
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
        return this.#drag !== undefined || this.#searchDy !== undefined;
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
        const max = this.#expandable ? Math.max(0, Math.round(px)) : 0;
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

    /** The emoji panel's search, as the sheet shows it. */
    get search(): Search {
        return this.#search;
    }

    setSearch(search: Search): void {
        this.#search = search;
    }

    /** The backdrop over everything above the sheet (`panelVeil`). */
    get veil(): { opacity: number; tappable: boolean } {
        return panelVeil(this.f, this.#search !== "none");
    }

    /**
     * A tap on the backdrop, or anywhere outside the sheet: back to rest, and out of a search (its
     * keyboard hidden); nothing while it doesn't take taps (at rest).
     */
    veilTapped(): void {
        if (!this.veil.tappable || this.dragging) return;
        this.rest();
        if (this.#search !== "none") this.onLeaveSearch?.("rest");
    }

    /** The emoji search's strip, moved by the finger (down positive), or 0. */
    get searchOffset(): number {
        return this.#searchDy === undefined ? 0 : searchPullOffset(this.#searchDy);
    }

    /** How far down the finger has taken the sheet since the drag started (the GIF search's pull). */
    get dragDown(): number {
        const start = this.#start;
        const last = this.#moves.at(-1);
        return start === undefined || last === undefined ? 0 : last.y - start.y;
    }

    /** A tap at `t` comes from the end of a drag (over a tile or an emoji): not a tap. */
    clickGuarded(t: number): boolean {
        return t - this.#lastDragEnd < CLICK_GUARD_MS;
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
        this.#start = { y, grown: this.grown, spot: this.#spot };
        this.#moves = [{ t, y }];
        this.#moved = false;
        if (this.#search === "strip") {
            this.#searchDy = 0;
            return;
        }
        this.measure();
        this.#drag = { grown: this.grown, pulled: 0 };
    }

    dragMove(y: number, t: number): void {
        const start = this.#start;
        if (start === undefined) return;
        this.#moves.push({ t, y });
        if (this.#moves.length > 12) this.#moves.shift();
        if (Math.abs(y - start.y) > 4) this.#moved = true;
        if (this.#searchDy !== undefined) {
            this.#searchDy = y - start.y;
            return;
        }
        this.#drag = dragPosition(start.grown, y - start.y, this.#maxGrow);
    }

    /** A finger went down on the panel's scrolling content. */
    pullStart(y: number): void {
        this.#pull = { top: y, y, atTop: undefined, firstUp: undefined, taken: false };
    }

    /**
     * The finger moved on the content, scrolled to `scrollTop`: true once the panel has the
     * gesture (`pullTakesPanel`), and the content mustn't scroll. The panel follows from there.
     */
    pullMove(y: number, t: number, scrollTop: number): boolean {
        const pull = this.#pull;
        if (pull === undefined || this.#closing) return false;
        if (pull.taken) {
            this.dragMove(y, t);
            return true;
        }
        if (pull.firstUp === undefined && y !== pull.y) pull.firstUp = y < pull.y;
        pull.y = y;
        // counted from where it's seen at the top (from the start, if it was there then)
        if (scrollTop > 0) {
            pull.atTop = false;
            pull.top = y;
        } else if (pull.atTop === false) {
            pull.atTop = true;
            pull.top = y;
        } else {
            pull.atTop = true;
        }
        if (!pullTakesPanel({ firstUp: pull.firstUp ?? false, scrollTop, fromTop: y - pull.top })) {
            return false;
        }
        pull.taken = true;
        this.dragStart(y, t);
        return true;
    }

    /** The finger's off the content: where the panel settles, if it had the gesture. */
    pullEnd(t: number): Settle | SearchPull | undefined {
        const taken = this.#pull?.taken ?? false;
        this.#pull = undefined;
        return taken ? this.dragEnd(t) : undefined;
    }

    /** The finger's off: where the panel settles ("close": the host slides it out and closes it). */
    dragEnd(t: number): Settle | SearchPull | undefined {
        const start = this.#start;
        const at = this.#drag;
        const searchDy = this.#searchDy;
        this.#start = undefined;
        if (this.#moved) this.#lastDragEnd = t;
        const last = this.#moves.at(-1);
        if (last !== undefined && t - last.t > 100) this.#moves = [];
        if (searchDy !== undefined) {
            this.#searchDy = undefined;
            const pulled = searchPullEnd(searchDy, flickVelocity(this.#moves));
            if (pulled !== "stay") this.onLeaveSearch?.(pulled);
            return pulled;
        }
        if (start === undefined || at === undefined) return undefined;
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
