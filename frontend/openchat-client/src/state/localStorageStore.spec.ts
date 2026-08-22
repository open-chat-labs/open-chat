import { LocalStorageBoolStore, LocalStorageStore } from "./localStorageStore";

const KEY = "test_local_storage_store";

describe("LocalStorageStore", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("falls back to the default when nothing is stored", () => {
        const store = new LocalStorageStore(KEY, "def");
        expect(store.value).toEqual("def");
    });

    test("initialises from local storage when a value is stored", () => {
        localStorage.setItem(KEY, "stored");
        const store = new LocalStorageStore(KEY, "def");
        expect(store.value).toEqual("stored");
    });

    test("set updates the value and writes it to local storage", () => {
        const store = new LocalStorageStore(KEY, "def");
        store.set("updated");
        expect(store.value).toEqual("updated");
        expect(localStorage.getItem(KEY)).toEqual("updated");
    });

    test("set of undefined removes the stored value", () => {
        const store = new LocalStorageStore<string | undefined>(KEY, undefined);
        store.set("updated");
        store.set(undefined);
        expect(store.value).toBeUndefined();
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    test("update writes the updated value to local storage", () => {
        const store = new LocalStorageStore(KEY, "def");
        store.update((v) => v + "!");
        expect(store.value).toEqual("def!");
        expect(localStorage.getItem(KEY)).toEqual("def!");
    });

    test("serialiser and deserialiser are applied", () => {
        localStorage.setItem(KEY, "10");
        const store = new LocalStorageStore<number>(
            KEY,
            0,
            (n) => n.toString(),
            (n) => Number(n),
        );
        expect(store.value).toEqual(10);
        store.set(20);
        expect(localStorage.getItem(KEY)).toEqual("20");
    });

    test("subscribers see values set transiently", () => {
        const store = new LocalStorageStore(KEY, "def");
        const seen: string[] = [];
        store.subscribe((v) => seen.push(v), undefined);
        store.setTransient("a");
        store.setTransient("b");
        expect(seen).toEqual(["def", "a", "b"]);
        expect(store.value).toEqual("b");
    });

    test("setTransient does not write to local storage until persist is called", () => {
        const store = new LocalStorageStore(KEY, "def");
        store.setTransient("a");
        store.setTransient("b");
        expect(localStorage.getItem(KEY)).toBeNull();

        store.persist();
        expect(localStorage.getItem(KEY)).toEqual("b");
    });

    test("persist of an undefined value removes the stored value", () => {
        const store = new LocalStorageStore<string | undefined>(KEY, undefined);
        store.set("a");
        store.setTransient(undefined);
        expect(localStorage.getItem(KEY)).toEqual("a");
        store.persist();
        expect(localStorage.getItem(KEY)).toBeNull();
    });
});

describe("LocalStorageBoolStore", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("toggle flips the value and persists it", () => {
        const store = new LocalStorageBoolStore(KEY, false);
        store.toggle();
        expect(store.value).toEqual(true);
        expect(localStorage.getItem(KEY)).toEqual("true");
    });
});
