// What a puzzle screen shows as a solve lands (native plan 14, "Solving"): the board until the
// puzzle is solved; a solve made here plays the "Challenge solved" banner over the board first (a
// tap skips it), then the solved view; a puzzle already solved when the screen opened shows the
// solved view at once, with no banner. Once the solved view shows, it stays. As the library's
// PuzzleDialog does with `holdSolved` / `solvedReady`.

export type SolveView = "board" | "banner" | "solved";

export class SolveReveal {
    #view = $state<SolveView>("board");

    /** `solvedAtOpen`: the puzzle was solved before the screen opened. */
    constructor(solvedAtOpen: boolean) {
        if (solvedAtOpen) this.#view = "solved";
    }

    get view(): SolveView {
        return this.#view;
    }

    /** The game says whether it's solved (as it changes): a solve made here plays the banner. */
    observe(solved: boolean): void {
        if (solved && this.#view === "board") this.#view = "banner";
    }

    /** The banner has played out, or was tapped to skip it. */
    bannerDone(): void {
        if (this.#view === "banner") this.#view = "solved";
    }
}
