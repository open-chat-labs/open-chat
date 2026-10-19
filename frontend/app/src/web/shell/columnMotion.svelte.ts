// When the right column plays its open and close motion (Shell.svelte). The motion itself is CSS,
// from the tokens (duration, easing, reduced motion); this says which of it plays, and keeps a
// closing column mounted until its animation ends.
export class ColumnMotion {
    #open = $state(false);
    #mode: string;
    entering = $state(false);
    closing = $state(false);

    constructor(open: boolean, mode: string) {
        this.#open = open;
        this.#mode = mode;
    }

    /** Whether the column is in the page: open, or on its way out. */
    get shown(): boolean {
        return this.#open || this.closing;
    }

    /**
     * The column's state now. Opening and closing play their motion; a window crossing the docking
     * width (a new `mode`) swaps one form for the other at once, open or not.
     */
    update(open: boolean, mode: string): void {
        if (mode !== this.#mode) {
            this.#mode = mode;
            this.#open = open;
            this.entering = this.closing = false;
            return;
        }
        if (open === this.#open) return;
        this.#open = open;
        this.entering = open;
        this.closing = !open;
    }

    /** Its animation ended: an opened column stays, a closed one goes. */
    ended(): void {
        this.entering = this.closing = false;
    }
}
