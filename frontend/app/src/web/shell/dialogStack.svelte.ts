import { subscribe } from "@client";

/**
 * The backdrop a dialog handed off from showed, which the one handed off to keeps: the dialogs'
 * veil (a user card's, the linked dialogs'), which a plain dialog's lighter scrim wears as it takes
 * over; or the theme's scrim (a plain dialog's, as the replace confirm's), which a dialog keeps as
 * its own.
 */
export type HandOffBackdrop = "veil" | "scrim";

// The dialogs the app has opened itself (not the ones a URL opens), the newest on top. A navigation
// closes them all, as the old UI's modal stack was (closeModalStack), and so does Back.
export class DialogStack<D> {
    // raw: a dialog is a value, kept as itself, so it closes by identity
    #items = $state.raw<D[]>([]);
    // the dialog one handed off to, until its screen claims the backdrop as it opens
    #handedOffTo: D | undefined;
    // the backdrop the dialog handed off from showed, which the one handed off to keeps
    #handOffBackdrop: HandOffBackdrop = "veil";

    get items(): readonly D[] {
        return this.#items;
    }

    open(dialog: D): void {
        this.#items = [...this.#items, dialog];
    }

    /** Opens a dialog on top in place of the open ones it replaces (another user's card …). */
    replace(dialog: D, replaces: (open: D) => boolean): void {
        this.#items = [...this.#items.filter((item) => !replaces(item)), dialog];
    }

    /**
     * Opens `next` in `from`'s place over the same backdrop (the user card's Suspend user, and its
     * back arrow): `from` goes at once, with no exit, and `next`'s screen keeps the backdrop that
     * was showing (claimHandOff) rather than fading in its own. With `from` already closed there's
     * no backdrop to keep, and `next` opens as any other.
     */
    handOff(from: D, next: D, backdrop: HandOffBackdrop = "veil"): void {
        this.#handedOffTo = this.#items.includes(from) ? next : undefined;
        this.#handOffBackdrop = backdrop;
        this.replace(next, (open) => open === from);
    }

    /** Whether `dialog` was handed off to, once, as its screen opens. */
    claimHandOff(dialog: D): boolean {
        return this.claimHandOffBackdrop(dialog) !== undefined;
    }

    /**
     * The backdrop `dialog` keeps if it was handed off to (claimHandOff), once, as its screen
     * opens: what the dialog it took the place of showed.
     */
    claimHandOffBackdrop(dialog: D): HandOffBackdrop | undefined {
        if (this.#handedOffTo !== dialog) return undefined;
        this.#handedOffTo = undefined;
        return this.#handOffBackdrop;
    }

    close(dialog: D): void {
        this.#items = this.#items.filter((item) => item !== dialog);
    }

    closeAll(): void {
        if (this.#items.length > 0) this.#items = [];
    }
}

/**
 * Closes the stack before any navigation (navigate() publishes closeModalStack, and goes once the
 * dialogs are closed) and on Back or Forward, which change the page without navigate(). Returns
 * the unsubscribe.
 */
export function closeOnNavigation<D>(stack: DialogStack<D>): () => void {
    const closeAll = () => stack.closeAll();
    const unsubscribe = subscribe("closeModalStack", closeAll);
    window.addEventListener("popstate", closeAll);
    return () => {
        unsubscribe();
        window.removeEventListener("popstate", closeAll);
    };
}
