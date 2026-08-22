import { writable } from "svelte/store";
import { createMapStore } from "./mapStore";

function create() {
    return createMapStore(writable(new Map<string, number>()));
}

describe("createMapStore", () => {
    test("insert publishes the updated map", () => {
        const store = create();
        const seen: Map<string, number>[] = [];
        store.subscribe((v) => seen.push(new Map(v)));

        store.insert("a", 1);

        expect(seen.length).toEqual(2);
        expect(seen[0].size).toEqual(0);
        expect([...seen[1]]).toEqual([["a", 1]]);
    });

    test("delete removes an existing key and reports whether it did", () => {
        const store = create();
        store.subscribe(() => {});
        store.insert("a", 1);

        expect(store.delete("b")).toEqual(false);
        expect(store.delete("a")).toEqual(true);
        expect(store.size()).toEqual(0);
    });

    test("size reflects the current map", () => {
        const store = create();
        store.subscribe(() => {});
        expect(store.size()).toEqual(0);
        store.insert("a", 1);
        store.insert("b", 2);
        expect(store.size()).toEqual(2);
    });

    test("clear empties the map", () => {
        const store = create();
        store.subscribe(() => {});
        store.insert("a", 1);
        store.clear();
        expect(store.size()).toEqual(0);
    });

    test("update replaces the map", () => {
        const store = create();
        store.subscribe(() => {});
        store.update(() => new Map([["z", 26]]));
        expect(store.size()).toEqual(1);
        expect(store.get("z")).toEqual(26);
    });

    test("get and has read the current map", () => {
        const store = create();
        store.subscribe(() => {});

        expect(store.has("a")).toEqual(false);
        expect(store.get("a")).toBeUndefined();

        store.insert("a", 1);

        expect(store.has("a")).toEqual(true);
        expect(store.get("a")).toEqual(1);
    });

    test("get and has follow a wholesale set of the underlying store", () => {
        const store = create();
        store.subscribe(() => {});
        store.set(new Map([["b", 2]]));

        expect(store.has("b")).toEqual(true);
        expect(store.get("b")).toEqual(2);
    });
});
