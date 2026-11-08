// The photos and videos picked in an attach panel before they're attached (native plan 06
// "Selecting media"): in the order they were picked, numbered by it, up to a most. One selection
// for the panel's strip and its expanded grid.

/** At most this many photos and videos go with one message's draft. */
export const MAX_MEDIA = 10;

/** Something that can be picked: its id (unique among those offered) and whether it's a video. */
export type Pickable = { id: string; video: boolean };

/** What a tap on one did: picked it, put it back, or nothing, the most being picked already. */
export type PickOutcome = "picked" | "unpicked" | "full";

export class MediaSelection<T extends Pickable> {
    #picked = $state.raw<T[]>([]);
    #max = $state(MAX_MEDIA);

    constructor(max: number = MAX_MEDIA) {
        this.#max = max;
    }

    /** Those picked, in the order they were. */
    get picked(): readonly T[] {
        return this.#picked;
    }

    get count(): number {
        return this.#picked.length;
    }

    /** How many may be picked (fewer than `MAX_MEDIA` when some are attached already). */
    get max(): number {
        return this.#max;
    }

    set max(max: number) {
        this.#max = Math.max(0, max);
    }

    /** How many photos and how many videos are picked. */
    get counts(): { photos: number; videos: number } {
        const videos = this.#picked.filter((p) => p.video).length;
        return { photos: this.#picked.length - videos, videos };
    }

    /** Its number in the selection (1 for the first picked), or undefined, not picked. */
    numberOf(id: string): number | undefined {
        const i = this.#picked.findIndex((p) => p.id === id);
        return i < 0 ? undefined : i + 1;
    }

    /** Picks it, or, picked, puts it back (those after it move up a number). */
    toggle(item: T): PickOutcome {
        if (this.numberOf(item.id) !== undefined) {
            this.#picked = this.#picked.filter((p) => p.id !== item.id);
            return "unpicked";
        }
        if (this.#picked.length >= this.#max) return "full";
        this.#picked = [...this.#picked, item];
        return "picked";
    }

    clear(): void {
        if (this.#picked.length > 0) this.#picked = [];
    }
}
