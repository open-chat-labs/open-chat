// What's open over the screens (a bottom sheet, an anchored or long-press menu), newest last, so
// Android's system back closes it before it pops a screen (native design notes §2). The kit's
// sheets and menus take `open` / `onClose`; the screen that opens one registers its close here
// while it's open (`useOverlay`).

import { untrack } from "svelte";

// `busy`: while it's true the overlay can't close (something's on its way, as an account being
// deleted), so back leaves it open, and is used up.
type Entry = { id: number; close: () => void; busy?: () => boolean };

export class Overlays {
    #open = $state.raw<Entry[]>([]);
    #nextId = 1;

    /** Whether anything is open. */
    get any(): boolean {
        return this.#open.length > 0;
    }

    /**
     * Registers something open, with how to close it. Returns the call that unregisters it. Neither
     * tracks what's open, so an effect can register. While `busy()`, it can't be closed.
     */
    add(close: () => void, busy?: () => boolean): () => void {
        const id = this.#nextId++;
        this.#open = [...untrack(() => this.#open), { id, close, busy }];
        return () => {
            this.#open = untrack(() => this.#open).filter((entry) => entry.id !== id);
        };
    }

    /** Closes what was opened last, unless it's busy; whether there was anything to close. */
    closeTop(): boolean {
        const top = this.#open[this.#open.length - 1];
        if (top === undefined) return false;
        if (top.busy?.()) return true;
        this.#open = this.#open.slice(0, -1);
        top.close();
        return true;
    }
}

/**
 * Keeps an overlay registered while `isOpen()`: call it while a component initialises, with the
 * close its sheet or menu's `onClose` does, and while it can't close, `busy`. Unregistered when it
 * closes or the component goes.
 */
export function useOverlay(
    overlays: Overlays,
    isOpen: () => boolean,
    close: () => void,
    busy?: () => boolean,
): void {
    $effect(() => {
        if (isOpen()) return overlays.add(close, busy);
    });
}
