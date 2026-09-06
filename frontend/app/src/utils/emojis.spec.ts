import type { CustomEmoji, PremiumItem } from "@client";
import { beforeEach, describe, expect, test, vi } from "vitest";

const constructed = vi.fn();

const { customEmojis, premiumItemsStore } = vi.hoisted(() => ({
    customEmojis: new Map<string, CustomEmoji>(),
    premiumItemsStore: { value: new Set<PremiumItem>() },
}));

// The emoji helpers only read these two stores. Loading the entire client
// barrel inside the first dynamic import also loads unrelated wallet/auth code
// and makes the database-fallback test depend on cold build performance.
vi.mock("@client", () => ({ customEmojis, premiumItemsStore }));

beforeEach(() => {
    customEmojis.clear();
    premiumItemsStore.value.clear();
});

vi.mock("emoji-picker-element", () => {
    class Database {
        constructor() {
            constructed();
        }
        ready() {
            return Promise.resolve();
        }
        getPreferredSkinTone() {
            return Promise.resolve(0);
        }
        getEmojiBySearchQuery() {
            return Promise.resolve([]);
        }
        getEmojiByUnicodeOrName() {
            return Promise.resolve(undefined);
        }
        getTopFavoriteEmoji() {
            return Promise.resolve([]);
        }
        getEmojiByShortcode() {
            return Promise.resolve(undefined);
        }
        incrementFavoriteEmojiCount() {
            /* noop */
        }
    }
    return { Database };
});

const family = "\u{1F469}‍\u{1F469}‍\u{1F467}‍\u{1F466}"; // 👩‍👩‍👧‍👦
const nativeEmojis = [
    { unicode: "😀" },
    { unicode: "👍", skins: [{ tone: 1, unicode: "👍🏻" }] },
    { unicode: family },
];

// Minimal stand-in for the slice of IndexedDB that getAllNativeEmojis touches.
// `mode` "loads" resolves with `nativeEmojis`, "fails" makes the open request error.
function stubIndexedDb(mode: "loads" | "fails"): { opened: () => number } {
    let opens = 0;
    const open = () => {
        opens++;
        const request: Record<string, unknown> = { error: null, onerror: null, onsuccess: null };
        queueMicrotask(() => {
            if (mode === "fails") {
                (request.onerror as (() => void) | null)?.();
                return;
            }
            request.result = {
                close: () => undefined,
                transaction: () => ({
                    objectStore: () => ({
                        index: () => ({
                            getAll: () => {
                                const getAllRequest: Record<string, unknown> = {
                                    error: null,
                                    onerror: null,
                                    onsuccess: null,
                                    result: nativeEmojis,
                                };
                                queueMicrotask(() =>
                                    (getAllRequest.onsuccess as (() => void) | null)?.(),
                                );
                                return getAllRequest;
                            },
                        }),
                    }),
                }),
            };
            (request.onsuccess as (() => void) | null)?.();
        });
        return request;
    };
    vi.stubGlobal("indexedDB", { open });
    return { opened: () => opens };
}

async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

describe("isSingleEmoji", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
        constructed.mockClear();
    });

    test("regex fallback when the emoji set cannot be loaded", async () => {
        const db = stubIndexedDb("fails");
        const { isSingleEmoji } = await import("./emojis");
        // trigger the (failing) load and let it settle
        isSingleEmoji("x");
        await flush();

        expect(db.opened()).toBe(1);
        expect(constructed).toHaveBeenCalledTimes(1);
        expect(isSingleEmoji("😀")).toBe(true);
        expect(isSingleEmoji("👍")).toBe(true);
        expect(isSingleEmoji("hello")).toBe(false);
        expect(isSingleEmoji("")).toBe(false);
        expect(isSingleEmoji("😀😀")).toBe(false);
        expect(isSingleEmoji("😀 ")).toBe(false);
        // multi-codepoint sequences are not Extended_Pictographic single chars
        expect(isSingleEmoji(family)).toBe(false);
        expect(isSingleEmoji("👍🏻")).toBe(false);
        // custom emoji are matched by shape, without the database
        expect(isSingleEmoji("!emoji(party_parrot)")).toBe(true);
        expect(isSingleEmoji("!emoji()")).toBe(false);
        expect(isSingleEmoji("prefix !emoji(x)")).toBe(false);
    });

    test("multi-codepoint sequences match once the emoji set has loaded", async () => {
        stubIndexedDb("loads");
        const { isSingleEmoji } = await import("./emojis");
        isSingleEmoji("x");
        await flush();

        expect(isSingleEmoji(family)).toBe(true);
        expect(isSingleEmoji("👍🏻")).toBe(true);
        expect(isSingleEmoji("😀")).toBe(true);
        expect(isSingleEmoji("hello")).toBe(false);
        expect(isSingleEmoji("😀😀")).toBe(false);
    });

    test("the emoji set is only read from IndexedDB once", async () => {
        const db = stubIndexedDb("loads");
        const { isSingleEmoji } = await import("./emojis");
        isSingleEmoji("a");
        await flush();
        isSingleEmoji("b");
        isSingleEmoji("c");
        await flush();

        expect(db.opened()).toBe(1);
    });
});

describe("the emoji Database", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
        constructed.mockClear();
    });

    test("is not constructed just by importing the module", async () => {
        stubIndexedDb("loads");
        await import("./emojis");
        await flush();

        expect(constructed).not.toHaveBeenCalled();
    });

    test("is shared between emojis.ts and the quickReactions store", async () => {
        stubIndexedDb("loads");
        const { isSingleEmoji, getEmojiDatabase } = await import("./emojis");
        isSingleEmoji("😀");
        await import("../stores/quickReactions");
        await flush();

        expect(constructed).toHaveBeenCalledTimes(1);
        expect(getEmojiDatabase()).toBe(getEmojiDatabase());
        expect(constructed).toHaveBeenCalledTimes(1);
    });

    test("custom emoji helpers read the supplied catalog and premium store without opening a database", async () => {
        const emoji: CustomEmoji = {
            kind: "custom",
            code: "party_parrot",
            url: "/assets/emoji/party_parrot.webp",
            filename: "party_parrot.webp",
            premiumItem: 0,
        };
        customEmojis.set(emoji.code, emoji);
        const { searchCustomEmojis, summaryToSelectedEmoji } = await import("./emojis");

        expect(searchCustomEmojis("PARTY")).toEqual([]);
        premiumItemsStore.value.add(emoji.premiumItem);
        const summary = { kind: "custom" as const, code: emoji.code, url: emoji.url };
        expect(searchCustomEmojis("PARTY")).toEqual([summary]);
        expect(searchCustomEmojis("absent")).toEqual([]);
        expect(summaryToSelectedEmoji(summary)).toBe(emoji);
        premiumItemsStore.value.clear();
        expect(searchCustomEmojis("PARTY")).toEqual([]);
        expect(constructed).not.toHaveBeenCalled();
    });
});
