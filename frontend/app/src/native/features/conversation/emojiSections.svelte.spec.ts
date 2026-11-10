import type { PickerEmoji } from "@src/utils/emojiCategories";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EMOJI_SEARCH_DELAY_MS, EmojiSections, type EmojiSource } from "./emojiSections.svelte";

// the emoji data isn't touched: each test brings its own source
vi.mock("@src/utils/emojis", () => ({ emojiInCategory: vi.fn(), emojiMatching: vi.fn() }));

const emoji = (char: string): PickerEmoji => ({ char, base: char, name: char });

function memory(entries: Record<string, string> = {}) {
    const kept = new Map(Object.entries(entries));
    return {
        getItem: (key: string) => kept.get(key) ?? null,
        setItem: (key: string, value: string) => void kept.set(key, value),
        kept,
    };
}

function source(found: Record<string, PickerEmoji[]> = {}): EmojiSource {
    return {
        inCategory: vi.fn(async (group: number) => [emoji(`g${group}`)]),
        matching: vi.fn(async (query: string) => found[query] ?? []),
    };
}

const KEY = "openchat_recent_emoji_me";

describe("the emoji a picker offers", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("start from the Recent kept for the user, the composer's and the reaction sheet's alike", () => {
        const storage = memory({ [KEY]: JSON.stringify(["🦊", "🎉"]) });
        expect(new EmojiSections("me", storage, source()).recent).toEqual(["🦊", "🎉"]);
        expect(new EmojiSections("someone", storage, source()).recent).toHaveLength(8);
    });

    test("move a pick to the front of Recent and keep it for the next picker", () => {
        const storage = memory({ [KEY]: JSON.stringify(["🦊", "🎉"]) });
        const sections = new EmojiSections("me", storage, source());
        sections.picked("🎉");
        expect(sections.recent).toEqual(["🎉", "🦊"]);
        expect(new EmojiSections("me", storage, source()).recent).toEqual(["🎉", "🦊"]);
    });

    describe("given no storage of their own", () => {
        afterEach(() => {
            vi.restoreAllMocks();
            window.localStorage.removeItem(KEY);
        });

        test("keep Recent on the device", () => {
            new EmojiSections("me", undefined, source()).picked("🦊");
            expect(new EmojiSections("me", undefined, source()).recent[0]).toBe("🦊");
            expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")[0]).toBe("🦊");
        });

        test("keep none where the device's storage can't be had", () => {
            vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
                throw new DOMException("blocked", "SecurityError");
            });
            const sections = new EmojiSections("me", undefined, source());
            expect(sections.recent).toEqual([]);
            sections.picked("🦊");
            expect(sections.recent).toEqual(["🦊"]);
        });
    });

    test("are loading until the categories are in, or have failed", async () => {
        const sections = new EmojiSections("me", memory(), source());
        expect(sections.loading).toBe(true);
        await sections.load();
        expect(sections.loading).toBe(false);
        expect(sections.categories[0]).toEqual([emoji("g0")]);

        const failing = new EmojiSections("me", memory(), {
            ...source(),
            inCategory: () => Promise.reject(new Error("offline")),
        });
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await failing.load();
        expect(failing.failed).toBe(true);
        expect(failing.loading).toBe(false);
    });

    test("search once typing pauses, for what's typed last", async () => {
        const from = source({ fox: [emoji("🦊")] });
        const sections = new EmojiSections("me", memory(), from);
        sections.search("fo");
        sections.search("fox ");
        await vi.advanceTimersByTimeAsync(EMOJI_SEARCH_DELAY_MS);
        expect(from.matching).toHaveBeenCalledTimes(1);
        expect(from.matching).toHaveBeenCalledWith("fox");
        expect(sections.matches).toEqual([emoji("🦊")]);

        sections.search("  ");
        await vi.advanceTimersByTimeAsync(EMOJI_SEARCH_DELAY_MS);
        expect(sections.matches).toBeUndefined();
    });

    test("drop a search on its way once it's cleared", async () => {
        let settle: (found: PickerEmoji[]) => void = () => {};
        const sections = new EmojiSections("me", memory(), {
            ...source(),
            matching: () => new Promise((resolve) => (settle = resolve)),
        });
        sections.search("fox");
        await vi.advanceTimersByTimeAsync(EMOJI_SEARCH_DELAY_MS);
        sections.clearSearch();
        settle([emoji("🦊")]);
        await vi.advanceTimersByTimeAsync(0);
        expect(sections.matches).toBeUndefined();
    });
});
