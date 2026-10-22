import { configKeys } from "@shared";
import type { ShellLayout } from "./layout";
import { ModePreference } from "./modePreference.svelte";

// Whether the right column (details, members, thread …) shows. Docked, it's a preference that
// lasts across visits (brief §4), open unless the user closed it. As a modal, below the docking
// width, it only opens when asked to and isn't remembered, so a page never loads behind a modal.
// Create it while a component initialises: it follows the layout's mode from then on.
export class RightColumnState {
    #mode: () => ShellLayout["right"];
    #docked: ModePreference;
    #modal = $state(false);

    constructor(mode: () => ShellLayout["right"]) {
        this.#mode = mode;
        this.#docked = new ModePreference(
            configKeys.webRightColumnOpen,
            true,
            () => mode() === "dock",
        );
        // a modal left open when the window widened past the docking width doesn't come back by
        // itself once it narrows again
        $effect(() => {
            if (mode() === "dock") this.#modal = false;
        });
    }

    get open(): boolean {
        return this.#mode() === "dock" ? this.#docked.value : this.#modal;
    }

    set open(open: boolean) {
        if (this.#mode() === "modal") {
            this.#modal = open;
            return;
        }
        this.#docked.value = open;
    }

    toggle(): void {
        this.open = !this.open;
    }
}
