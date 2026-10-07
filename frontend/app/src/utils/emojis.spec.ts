import { beforeEach, describe, expect, test, vi } from "vitest";

const constructed = vi.fn();
// how many of the next Databases fail their first load, like the real one does
// when IndexedDB is empty and the emoji CDN errors
const failingLoads = { remaining: 0 };

vi.mock("emoji-picker-element", () => {
    class Database {
        private readonly _ready: Promise<void>;
        constructor() {
            constructed();
            this._ready =
                failingLoads.remaining-- > 0
                    ? Promise.reject(new Error("Failed to fetch: emoji data: 500"))
                    : Promise.resolve();
            this._ready.catch(() => undefined);
        }
        ready() {
            return this._ready;
        }
        getPreferredSkinTone() {
            return this._ready.then(() => 0);
        }
        getEmojiBySearchQuery() {
            return this._ready.then(() => [{ unicode: "😀", version: 1, shortcodes: ["grin"] }]);
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
        stubIndexedDb("fails");
        const { isSingleEmoji } = await import("./emojis");
        // trigger the (failing) load and let it settle
        isSingleEmoji("x");
        await flush();

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

    // Invariant: a Database whose first load failed is not reused, so emoji search
    // works again once the emoji data can be fetched, without restarting the app.
    test("is rebuilt after its first load fails, so search recovers", async () => {
        stubIndexedDb("loads");
        failingLoads.remaining = 1;
        const { searchAllEmojis } = await import("./emojis");

        expect(await searchAllEmojis("grin")).toEqual([]);
        await flush();
        expect(await searchAllEmojis("grin")).toEqual([
            { kind: "native", unicode: "😀", code: "grin" },
        ]);
        expect(constructed).toHaveBeenCalledTimes(2);
    });

    // Invariant: a Database whose first load failed is replaced only when a caller next
    // asks for one, never by itself, so a CDN outage can't start a loop of reloads.
    test("is not rebuilt after a failed load until a caller asks for it", async () => {
        stubIndexedDb("loads");
        failingLoads.remaining = 3;
        const { getEmojiDatabase } = await import("./emojis");

        // fake timers so a rebuild scheduled with a delay is caught too
        vi.useFakeTimers();
        try {
            getEmojiDatabase();
            await vi.runAllTimersAsync();
        } finally {
            vi.useRealTimers();
        }

        expect(constructed).toHaveBeenCalledTimes(1);
    });
});
