import { LocalStorageBoolStore } from "@client";
import { configKeys } from "@shared";
import type { ShellLayout } from "./layout";

// Whether the nav rail is expanded. Where it pushes the layout (a wide shell) it's a preference
// that lasts across visits: the user's own expand or collapse is remembered. Where it floats over
// the island it's a passing overlay, so it starts collapsed and what's done there isn't kept.
export class RailState {
    #mode: () => ShellLayout["rail"];
    #stored = new LocalStorageBoolStore(configKeys.webRailExpanded, false);
    #pushing = $state(this.#stored.value);

    constructor(mode: () => ShellLayout["rail"]) {
        this.#mode = mode;
    }

    /** What the rail starts as: the remembered choice where it pushes, collapsed where it floats. */
    get expanded(): boolean {
        return this.#mode() === "push" && this.#pushing;
    }

    /** The user expanded or collapsed it. */
    set expanded(expanded: boolean) {
        if (this.#mode() !== "push") return;
        this.#pushing = expanded;
        this.#stored.set(expanded);
    }
}
