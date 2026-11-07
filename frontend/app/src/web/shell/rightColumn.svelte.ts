import { configKeys } from "@shared";
import type { ShellLayout } from "./layout";
import { ModePreference } from "./modePreference.svelte";

// Whether the right column (details, members, thread …) shows. Docked, it's a preference that
// lasts across visits (brief §4), open unless the user closed it. As a modal, below the docking
// width, it only opens when asked to and isn't remembered, so a page never loads behind a modal.
// A thread opening shows it whatever the user chose (`showThread`), without changing that choice:
// closing the thread (`threadClosed`) leaves the column as it was before.
// Create it while a component initialises: it follows the layout's mode from then on.
export class RightColumnState {
    #mode: () => ShellLayout["right"];
    #docked: ModePreference;
    #modal = $state(false);
    // shown for the open thread, over the user's choice (which stays as it was)
    #forThread = $state(false);

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
        return this.#forThread || (this.#mode() === "dock" ? this.#docked.value : this.#modal);
    }

    /** The user's own opening or closing: it ends a thread's (`showThread`). */
    set open(open: boolean) {
        this.#forThread = false;
        if (this.#mode() === "modal") {
            this.#modal = open;
            return;
        }
        this.#docked.value = open;
    }

    toggle(): void {
        this.open = !this.open;
    }

    /**
     * Shows the column for a thread that's opening (docked or as the modal, by the window's width),
     * if it isn't showing; the user's choice is kept for when the thread closes.
     */
    showThread(): void {
        if (!this.open) this.#forThread = true;
    }

    /** The thread closed: the column goes back to what the user had chosen. */
    threadClosed(): void {
        this.#forThread = false;
    }
}
