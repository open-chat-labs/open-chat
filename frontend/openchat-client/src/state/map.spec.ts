/* eslint-disable @typescript-eslint/ban-ts-comment */
import { SafeMap } from "openchat-shared";
import { vi } from "vitest";
import { LocalMap } from "./map";

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
});

describe("LocalMap", () => {
    let map: TestLocalMap<string, string>;

    beforeEach(() => {
        map = new TestLocalMap();
    });

    it("make sure that automatic undo works", () => {
        map.addOrUpdate("a", "b");
        expect(map.addedOrUpdated("a")).toBe(true);
        expect(map.removed("a")).toBe(false);
        vi.runAllTimers();
        expect(map.addedOrUpdated("a")).toBe(false);
    });

    it("make sure manual undo works", () => {
        const undo = map.addOrUpdate("a", "b");
        expect(map.addedOrUpdated("a")).toBe(true);
        undo();
        expect(map.addedOrUpdated("a")).toBe(false);
        vi.runAllTimers();
        expect(map.addedOrUpdated("a")).toBe(false);
    });

    it("restores removed items on undo", () => {
        map.remove("a");
        const undo = map.addOrUpdate("a", "b");

        expect(map.addedOrUpdated("a")).toBe(true);
        expect(map.removed("a")).toBe(false);

        undo();

        expect(map.addedOrUpdated("a")).toBe(false);
        expect(map.removed("a")).toBe(true);
    });
});
