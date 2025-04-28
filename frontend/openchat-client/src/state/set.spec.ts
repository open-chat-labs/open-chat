/* eslint-disable @typescript-eslint/ban-ts-comment */
import { identity } from "openchat-shared";
import { vi } from "vitest";
import { LocalSet } from "./set";

vi.useFakeTimers();

describe("LocalSet", () => {
    let set: LocalSet<string>;

    beforeEach(() => {
        set = new LocalSet(identity);
    });

    it("make sure that automatic undo works", () => {
        set.add("a");
        expect(set.added.has("a")).toBe(true);
        expect(set.removed.has("a")).toBe(false);
        vi.runAllTimers();
        expect(set.added.has("a")).toBe(false);
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
        expect(set.removed.has("a")).toBe(false);

        undo();

        expect(set.added.has("a")).toBe(false);
        expect(set.removed.has("a")).toBe(true);
    });
});
