 
import { ChatSet, identity } from "openchat-shared";
import { vi } from "vitest";
import { LocalSet } from "./set";

vi.useFakeTimers();

describe("ChatSet", () => {
    test("basic test", () => {
        const set = new ChatSet();
        set.add({ kind: "group_chat", groupId: "123" });
        set.add({ kind: "group_chat", groupId: "456" });

        expect(set.has({ kind: "group_chat", groupId: "123" })).toBe(true);
        expect(set.has({ kind: "direct_chat", userId: "456" })).toBe(false);
    });
});

describe("LocalSet", () => {
    let set: LocalSet<string>;

    beforeEach(() => {
        set = new LocalSet(identity);
    });

    test("make sure that the order of operations doesn't cause a problem", () => {
        // perform two operations
        const removeUndo = set.remove("123");
        const addUndo = set.add("123");

        // undo them both
        removeUndo();
        addUndo();

        expect(set.added.has("123")).toBe(false);
        expect(set.removed.has("123")).toBe(false);
    });

    test("remove trumps add", () => {
        set.add("123");
        set.remove("123");
        set.add("123");
        set.remove("123");

        const original = new Set<string>();
        const result = set.apply(original);
        expect(result.has("123")).toBe(false);
    });

    test("last mod wins", () => {
        set.add("123");
        set.remove("123");
        set.remove("123");
        set.add("123");

        const original = new Set<string>();
        const result = set.apply(original);
        expect(result.has("123")).toBe(true);
    });

    test("multiple undos", () => {
        set.add("123");
        const u1 = set.remove("123");
        const u2 = set.remove("123");

        u1();
        u2();

        const original = new Set<string>();
        const result = set.apply(original);
        expect(result.has("123")).toBe(true);
    });

    it("make sure manual undo works", () => {
        const undo = set.add("a");
        expect(set.added.has("a")).toBe(true);
        undo();
        expect(set.added.has("a")).toBe(false);
        vi.runAllTimers();
        expect(set.added.has("a")).toBe(false);
    });

    it("restores removed items on undo", () => {
        set.remove("a");
        const undo = set.add("a");

        expect(set.added.has("a")).toBe(true);
        expect(set.removed.has("a")).toBe(true);

        undo();

        expect(set.added.has("a")).toBe(false);
        expect(set.removed.has("a")).toBe(true);
    });
});
