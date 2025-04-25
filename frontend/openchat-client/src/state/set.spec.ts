/* eslint-disable @typescript-eslint/ban-ts-comment */
import { identity } from "openchat-shared";
import { vi } from "vitest";
import { LocalSet } from "./set";

vi.useFakeTimers();

class TestSet<T> extends LocalSet<T> {
    added(thing: T) {
        return super.added(thing);
    }

    removed(thing: T) {
        return super.removed(thing);
    }
}

describe("LocalSet", () => {
    let set: TestSet<string>;

    beforeEach(() => {
        set = new TestSet(identity);
    });

    it("make sure that automatic undo works", () => {
        set.add("a");
        expect(set.added("a")).toBe(true);
        expect(set.removed("a")).toBe(false);
        vi.runAllTimers();
        expect(set.added("a")).toBe(false);
    });

    it("make sure manual undo works", () => {
        const undo = set.add("a");
        expect(set.added("a")).toBe(true);
        undo();
        expect(set.added("a")).toBe(false);
        vi.runAllTimers();
        expect(set.added("a")).toBe(false);
    });

    it("restores removed items on undo", () => {
        set.remove("a");
        const undo = set.add("a");

        expect(set.added("a")).toBe(true);
        expect(set.removed("a")).toBe(false);

        undo();

        expect(set.added("a")).toBe(false);
        expect(set.removed("a")).toBe(true);
    });
});
