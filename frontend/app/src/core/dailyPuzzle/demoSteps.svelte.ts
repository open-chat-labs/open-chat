import type { Violation } from "@client";
import type { DemoFrame } from "./games/types";
import type { DailyPuzzleGameDef } from "./registry";

// Stepping through a game's "how to play" demo (its DemoSpec's stills), as every tree's demo
// does: the web's and the old trees' GameDemo, and the native puzzle screen's tutorial, each
// drawing it its own way. The reader steps through the frames; nothing advances on a timer.

export class DemoSteps {
    index = $state(0);
    readonly #def: Pick<DailyPuzzleGameDef, "demo" | "newBoard">;

    constructor(def: Pick<DailyPuzzleGameDef, "demo" | "newBoard">) {
        this.#def = def;
    }

    /** How many frames the demo has; none without one. */
    get count(): number {
        return this.#def.demo?.frames.length ?? 0;
    }

    get last(): number {
        return Math.max(0, this.count - 1);
    }

    get isFirst(): boolean {
        return this.index === 0;
    }

    get isLast(): boolean {
        return this.index === this.last;
    }

    frame: DemoFrame | undefined = $derived.by(() => this.#def.demo?.frames[this.index]);

    // The frame's marks on the demo puzzle, parsed and checked by the game itself, so a
    // malformed demo fails here rather than drawing something the real board could never show.
    board = $derived.by(() => {
        const spec = this.#def.demo;
        const frame = this.frame;
        return spec === undefined || frame === undefined
            ? undefined
            : this.#def.newBoard(spec.description, frame.marks);
    });

    violations: Violation[] = $derived(this.board?.violations ?? []);

    // On a frame that breaks a rule the checker's red IS the message, and the translucent blue
    // "look here" wash sits on top of it and turns the red pink. Let the mistake speak alone.
    pointed: Set<number> = $derived(
        this.violations.length > 0 ? new Set<number>() : new Set(this.frame?.target ?? []),
    );

    prev(): void {
        this.index = Math.max(0, this.index - 1);
    }

    next(): void {
        this.index = Math.min(this.last, this.index + 1);
    }

    /** Tapping the board steps on, and past the last step starts the demo again. */
    tapBoard(): void {
        this.index = this.isLast ? 0 : this.index + 1;
    }

    /** Back to the first frame, for a demo shown again. */
    restart(): void {
        this.index = 0;
    }
}
