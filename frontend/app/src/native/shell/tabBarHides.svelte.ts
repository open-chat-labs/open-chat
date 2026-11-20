import { untrack } from "svelte";

// A tab's root that takes the whole window for a while, the tab bar out of the way: the Chats
// tab's search, from the field's tap until Cancel or back (user's request, 2026-11-20). Each
// screen says its own (ScreenContext.hideTabBar), and the shell asks the top screen's, so a tab
// switched to, or a screen pushed over it, has the bar as its kind does (`showsTabBar`).

export class TabBarHides {
    // each hiding screen's key, with who hid it there
    #hides = $state.raw<ReadonlyMap<string, object>>(new Map());

    /**
     * A screen's setter (its step's `key`): whether it hides the tab bar. A screen going doesn't
     * take back the hide of another at the same key. Neither tracks the hides, so an effect can
     * set.
     */
    for(key: string): (hidden: boolean) => void {
        const owner = {};
        return (hidden) => {
            const hides = untrack(() => this.#hides);
            const current = hides.get(key);
            if (!hidden) {
                if (current !== owner) return;
                const next = new Map(hides);
                next.delete(key);
                this.#hides = next;
                return;
            }
            if (current === owner) return;
            this.#hides = new Map(hides).set(key, owner);
        };
    }

    /** Whether the screen at `key` hides the tab bar. */
    hidden(key: string | undefined): boolean {
        return key !== undefined && this.#hides.has(key);
    }
}
