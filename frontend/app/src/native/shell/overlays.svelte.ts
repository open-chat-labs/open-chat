// What's open over the screens (a bottom sheet, an anchored or long-press menu), newest last, so
// Android's system back closes it before it pops a screen (native design notes §2). The kit's
// sheets and menus take `open` / `onClose`; the screen that opens one registers its close here
// while it's open (`useOverlay`).

import { untrack } from "svelte";

type Entry = { id: number; close: () => void };

export class Overlays {
    #open = $state.raw<Entry[]>([]);
    #nextId = 1;

    /** Whether anything is open. */
    get any(): boolean {
        return this.#open.length > 0;
    }

    /**
     * Registers something open, with how to close it. Returns the call that unregisters it. Neither
     * tracks what's open, so an effect can register.
     */
    add(close: () => void): () => void {
        const id = this.#nextId++;
        this.#open = [...untrack(() => this.#open), { id, close }];
        return () => {
            this.#open = untrack(() => this.#open).filter((entry) => entry.id !== id);
        };
    }

    /** Closes what was opened last; whether there was anything to close. */
    closeTop(): boolean {
        const top = this.#open[this.#open.length - 1];
        if (top === undefined) return false;
        this.#open = this.#open.slice(0, -1);
        top.close();
        return true;
    }
}

/**
 * Keeps an overlay registered while `isOpen()`: call it while a component initialises, with the
 * close its sheet or menu's `onClose` does. Unregistered when it closes or the component goes.
 */
export function useOverlay(overlays: Overlays, isOpen: () => boolean, close: () => void): void {
    $effect(() => {
        if (isOpen()) return overlays.add(close);
    });
}
