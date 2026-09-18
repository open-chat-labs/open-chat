import { describe, expect, test } from "vitest";
import { DragList } from "./dragList.svelte";

type Item = { _id: string; name: string };

const SHADOW = "shadow";

function item(id: string, name = id): Item {
    return { _id: id, name };
}

function ids(items: Item[]): string[] {
    return items.map((i) => i._id);
}

// What svelte-dnd-action does with the list it was last given: drag start replaces the
// dragged item with a shadow copy; dragging over an index removes the shadow and splices it
// back in at that index. The shadow keeps the dragged item's _id.
function dragStart(items: Item[], idx: number): Item[] {
    const next = [...items];
    next.splice(idx, 1, { ...items[idx], [SHADOW]: true } as Item);
    return next;
}

function dragOver(items: Item[], idx: number): Item[] {
    const next = [...items];
    const shadowIdx = next.findIndex((i) => SHADOW in i);
    const shadow = shadowIdx === -1 ? next[0] : next.splice(shadowIdx, 1)[0];
    next.splice(idx, 0, { ...shadow, [SHADOW]: true } as Item);
    return next;
}

describe("DragList", () => {
    test("invariant: a source update during a drag never gives two items the same key", () => {
        const list = new DragList<Item>();
        list.sync([item("a"), item("b"), item("c")]);

        list.consider(dragStart(list.items, 0));
        list.sync([item("a", "A"), item("b"), item("c")]);
        list.consider(dragOver(list.items, 2));

        expect(new Set(ids(list.items)).size).toBe(list.items.length);
        expect(ids(list.items)).toEqual(["b", "c", "a"]);
    });

    test("invariant: the drop applies source updates that arrived during the drag", () => {
        const list = new DragList<Item>();
        list.sync([item("a"), item("b"), item("c")]);

        list.consider(dragStart(list.items, 0));
        list.consider(dragOver(list.items, 2));
        list.sync([item("a", "A"), item("c"), item("d")]);
        const dropped = list.finalize(list.items.map(({ _id, name }) => ({ _id, name })));

        expect(dropped).toEqual([item("c"), item("a", "A"), item("d")]);
        expect(list.items).toEqual(dropped);
    });

    test("outside a drag a source update replaces the list", () => {
        const list = new DragList<Item>();
        list.sync([item("a"), item("b")]);
        list.sync([item("b"), item("a")]);
        expect(ids(list.items)).toEqual(["b", "a"]);
    });
});
