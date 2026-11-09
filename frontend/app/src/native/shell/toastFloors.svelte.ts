import { untrack } from "svelte";

// Where toasts sit over a screen whose footer grows (a conversation's composer over the keyboard
// or a panel; native design notes §1 Sheets, menus, toasts): each screen says its own
// (ScreenContext.toastFloor), and the shell takes the top screen's, so a screen under it, or one
// going, doesn't move them.

type Floor = { px: number; owner: object };

export class ToastFloors {
    #floors = $state.raw<ReadonlyMap<string, Floor>>(new Map());

    /**
     * A screen's setter (its step's `key`): its floor in CSS pixels from the window's bottom, or,
     * undefined, none. A screen going doesn't take back the floor of another at the same key (the
     * same chat opened again as the last goes). Neither tracks the floors, so an effect can set.
     */
    for(key: string): (px: number | undefined) => void {
        const owner = {};
        return (px) => {
            const floors = untrack(() => this.#floors);
            const current = floors.get(key);
            if (px === undefined) {
                if (current?.owner !== owner) return;
                const next = new Map(floors);
                next.delete(key);
                this.#floors = next;
                return;
            }
            if (current?.owner === owner && current.px === px) return;
            this.#floors = new Map(floors).set(key, { px, owner });
        };
    }

    /** The floor the screen at `key` set, if any. */
    of(key: string | undefined): number | undefined {
        return key === undefined ? undefined : this.#floors.get(key)?.px;
    }
}
