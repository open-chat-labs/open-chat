export type DragItem = { _id: string };

// svelte-dnd-action owns the list while a drag is in progress: it swaps the dragged item
// for a shadow copy and splices that shadow into whatever list it was last given. If the
// source store replaces the list mid-drag, the dragged item comes back and the next splice
// adds its shadow alongside it, giving two items with the same key. So source updates are
// held back until the drop and applied then.
export class DragList<T extends DragItem> {
    items = $state<T[]>([]);
    #latest: T[] = [];
    #dragging = false;

    sync(latest: T[]) {
        this.#latest = latest;
        if (!this.#dragging) {
            this.items = latest;
        }
    }

    consider(items: T[]) {
        this.#dragging = true;
        this.items = items;
    }

    // Keeps the dropped order, takes item data from the latest source list, drops items the
    // source no longer has and appends ones it gained during the drag.
    finalize(items: T[]): T[] {
        this.#dragging = false;
        const latest = new Map(this.#latest.map((i) => [i._id, i]));
        const kept = items.flatMap((i) => latest.get(i._id) ?? []);
        const keptIds = new Set(kept.map((i) => i._id));
        this.items = [...kept, ...this.#latest.filter((i) => !keptIds.has(i._id))];
        return this.items;
    }
}
