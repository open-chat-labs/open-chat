import { configKeys } from "@shared";
import type { ShellLayout } from "./layout";
import { ModePreference } from "./modePreference.svelte";

// Whether the nav rail is expanded. Where it pushes the layout (a wide shell) it's a preference
// that lasts across visits: the user's own expand or collapse is remembered. Where it floats over
// the island it's a passing overlay, so it starts collapsed and what's done there isn't kept.
// Create it while a component initialises.
export class RailState {
    #mode: () => ShellLayout["rail"];
    #pushed: ModePreference;

    constructor(mode: () => ShellLayout["rail"]) {
        this.#mode = mode;
        this.#pushed = new ModePreference(
            configKeys.webRailExpanded,
            false,
            () => mode() === "push",
        );
    }

    /** What the rail starts as: the remembered choice where it pushes, collapsed where it floats. */
    get expanded(): boolean {
        return this.#mode() === "push" && this.#pushed.value;
    }

    /** The user expanded or collapsed it. */
    set expanded(expanded: boolean) {
        this.#pushed.value = expanded;
    }
}
