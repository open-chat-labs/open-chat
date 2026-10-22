// The dialogs the app has opened itself (not the ones a URL opens), the newest on top. A navigation
// closes them all, as the old UI's modal stack was (closeModalStack).
export class DialogStack<D> {
    // raw: a dialog is a value, kept as itself, so it closes by identity
    #items = $state.raw<D[]>([]);

    get items(): readonly D[] {
        return this.#items;
    }

    open(dialog: D): void {
        this.#items = [...this.#items, dialog];
    }

    close(dialog: D): void {
        this.#items = this.#items.filter((item) => item !== dialog);
    }

    closeAll(): void {
        if (this.#items.length > 0) this.#items = [];
    }
}
