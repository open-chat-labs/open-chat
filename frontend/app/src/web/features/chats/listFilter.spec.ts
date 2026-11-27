import { describe, expect, test, vi } from "vitest";
import {
    listFilterAt,
    listFilterIndex,
    listFilterMemory,
    rememberListFilter,
} from "./listFilter";

describe("the chat list's remembered filter", () => {
    test("DMs and groups, and Favourites, each have one; a community's channels have none", () => {
        expect(listFilterMemory("chats")).toBe("chats");
        expect(listFilterMemory("favourite")).toBe("favourite");
        expect(listFilterMemory("community")).toBeUndefined();
        expect(listFilterMemory("none")).toBeUndefined();
    });

    test("a remembered filter selects its tab, in the panel's order", () => {
        expect(listFilterIndex("all")).toBe(0);
        expect(listFilterIndex("direct")).toBe(1);
        expect(listFilterIndex("groups")).toBe(2);
        expect(listFilterIndex("unread")).toBe(3);
    });

    test("nothing remembered, or an unknown value, is All", () => {
        expect(listFilterIndex(undefined)).toBe(0);
        expect(listFilterIndex("")).toBe(0);
        expect(listFilterIndex("archived")).toBe(0);
    });

    test("a tab is its filter, and one out of range is All", () => {
        expect(listFilterAt(3)).toBe("unread");
        expect(listFilterAt(9)).toBe("all");
        expect(listFilterIndex(listFilterAt(2))).toBe(2);
    });

    test("a picked tab is stored as its filter", () => {
        const store = { set: vi.fn() };
        rememberListFilter(store, 1);
        expect(store.set).toHaveBeenCalledWith("direct");
    });

    test("storage that can't be written doesn't throw", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const store = {
            set: () => {
                throw new Error("QuotaExceededError");
            },
        };
        expect(() => rememberListFilter(store, 3)).not.toThrow();
        warn.mockRestore();
    });
});
