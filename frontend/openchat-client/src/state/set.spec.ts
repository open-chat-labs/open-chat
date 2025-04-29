/* eslint-disable @typescript-eslint/ban-ts-comment */
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
