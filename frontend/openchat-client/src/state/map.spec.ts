import { ChatMap, SafeMap, type ChatIdentifier } from "@shared";
import { vi } from "vitest";
import { LocalChatMap, LocalMap } from "./map";

vi.useFakeTimers();

class TestLocalMap<K, V> extends LocalMap<K, V> {
    addedOrUpdated(key: K) {
        return super.addedOrUpdated(key);
    }

    removed(key: K) {
        return super.removed(key);
    }
}

describe("SafeMap", () => {
    test("primitive map works", () => {
        const m = new SafeMap();
        m.set("a", 1);
        m.set("b", 2);
        expect(m.size).toEqual(2);
    });
    test("object map works", () => {
        const m = new SafeMap(
            (k) => JSON.stringify(k),
            (k) => JSON.parse(String(k)),
        );
        m.set({ key: "a" }, 1);
        m.set({ key: "b" }, 2);
        expect(m.size).toEqual(2);
    });
    test("LocalChatMap apply round-trips keys by value", () => {
        const local = new LocalChatMap<string>();
        const a: ChatIdentifier = { kind: "channel", communityId: "c1", channelId: 1 };
        const b: ChatIdentifier = { kind: "group_chat", groupId: "g1" };
        const original = new ChatMap<string>();
        original.set(b, "b");
        local.addOrUpdate(a, "a");
        local.remove({ kind: "group_chat", groupId: "g1" });
        const result = local.apply(original);
        expect([...result.entries()]).toEqual([[a, "a"]]);
        expect(result.get({ kind: "channel", communityId: "c1", channelId: 1 })).toBe("a");
        expect(original.get(b)).toBe("b");
    });
});

describe("LocalMap", () => {
    let map: TestLocalMap<string, string>;

    beforeEach(() => {
        map = new TestLocalMap();
    });

    test("make sure that the order of operations doesn't cause a problem", () => {
        // perform two operations
        const removeUndo = map.remove("123");
        const addUndo = map.addOrUpdate("123", "456");

        // undo them both
        removeUndo();
        addUndo();

        expect(map.addedOrUpdated("123")).toBe(false);
        expect(map.removed("123")).toBe(false);
    });

    it("make sure manual undo works", () => {
        const undo = map.addOrUpdate("a", "b");
        expect(map.addedOrUpdated("a")).toBe(true);
        undo();
        expect(map.addedOrUpdated("a")).toBe(false);
        vi.runAllTimers();
        expect(map.addedOrUpdated("a")).toBe(false);
    });

    describe("apply", () => {
        const original = new SafeMap<string, string>();
        original.set("a", "1");
        original.set("b", "2");

        test("returns the original when there are no modifications", () => {
            expect(map.apply(original) === original).toBe(true);
        });

        test("does not mutate the original", () => {
            map.addOrUpdate("c", "3");
            map.remove("a");
            const result = map.apply(original);
            expect(original.get("a")).toEqual("1");
            expect(original.has("c")).toBe(false);
            expect(result.get("a")).toBeUndefined();
            expect(result.get("b")).toEqual("2");
            expect(result.get("c")).toEqual("3");
        });

        test("last modification per key wins", () => {
            map.addOrUpdate("a", "x");
            map.remove("a");
            map.addOrUpdate("a", "y");
            map.addOrUpdate("b", "p");
            map.remove("b");
            expect(map.apply(original).get("a")).toEqual("y");
            expect(map.apply(original).has("b")).toBe(false);
        });

        test("undone modifications are not applied", () => {
            const undo = map.addOrUpdate("a", "x");
            map.remove("b");
            undo();
            const result = map.apply(original);
            expect(result.get("a")).toEqual("1");
            expect(result.has("b")).toBe(false);
        });
    });

    it("restores removed items on undo", () => {
        map.remove("a");
        const undo = map.addOrUpdate("a", "b");

        expect(map.addedOrUpdated("a")).toBe(true);
        expect(map.removed("a")).toBe(true);

        undo();

        expect(map.addedOrUpdated("a")).toBe(false);
        expect(map.removed("a")).toBe(true);
    });
});
