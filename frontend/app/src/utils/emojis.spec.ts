import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";

// These tests import the module under test inside each test, so the first import's transform time
// counts against the timeout. Under a loaded CI runner that can pass the 5s default.
vi.setConfig({ testTimeout: 20_000 });

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

// Stands in for the canvas on a device whose emoji font draws `inColour` in colour and every other
// emoji in the plain text colour, and draws the emoji `drawnAsTwo` picks twice as wide as the rest.
// Records each emoji drawn and the fonts used. `inColour` null means there's no 2d canvas at all.
function stubCanvas(
    inColour: string[] | null,
    drawnAsTwo: (emoji: string) => boolean = () => false,
): { drawn: string[]; fonts: Set<string> } {
    const drawn: string[] = [];
    const fonts = new Set<string>();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => {
        if (inColour === null) return null;
        let text = "";
        const ctx = {
            textBaseline: "",
            font: "",
            fillStyle: "",
            scale: () => undefined,
            fillText: (emoji: string) => {
                text = emoji;
                fonts.add(ctx.font);
                if (ctx.fillStyle === "#000") drawn.push(emoji);
            },
            measureText: (emoji: string) => {
                fonts.add(ctx.font);
                return { width: drawnAsTwo(emoji) ? 200 : 100 };
            },
            getImageData: () => ({
                data: inColour.includes(text)
                    ? [255, 204, 77, 255]
                    : ctx.fillStyle === "#000"
                      ? [0, 0, 0, 255]
                      : [255, 255, 255, 255],
            }),
        };
        return ctx;
    }) as never);
    return { drawn, fonts };
}

// The test emoji (one per emoji version, newest first) and fonts from the installed library
function libraryEmojiSupportCheck(): { versions: [string, number][]; fontFamily: string } {
    const picker = readFileSync(
        createRequire(import.meta.url).resolve("emoji-picker-element/picker.js"),
        "utf8",
    );
    const table = picker.match(/const versionsAndTestEmoji = \{([\s\S]*?)\};/)![1];
    const versions = [...table.matchAll(/'(.+?)': ([\d.]+)/g)].map(
        ([, emoji, version]) => [emoji, Number(version)] as [string, number],
    );
    const fontFamily = [
        ...picker.match(/const FONT_FAMILY = ((?:'[^']*'\s*\+?\s*)+);/)![1].matchAll(/'([^']*)'/g),
    ]
        .map(([, part]) => part)
        .join("");
    return { versions, fontFamily };
}

describe("getEmojiSupportLevel", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    test("is the newest emoji version the device draws in colour", async () => {
        stubCanvas(["🥲", "🥰", "😀"]);
        const { getEmojiSupportLevel } = await import("./emojis");

        expect(getEmojiSupportLevel()).toBe(13.1);
    });

    // Invariant: emoji the font draws as two side by side aren't shown, as the library's own check
    // (turned off by emojiVersion) would have hidden them
    test("is x.0 rather than x.1 when the font draws x.1's joined emoji as two", async () => {
        const canvas = stubCanvas(["🫨", "🫠"], (emoji) => emoji !== "😀");
        const { getEmojiSupportLevel } = await import("./emojis");

        expect(getEmojiSupportLevel()).toBe(15);
        expect(canvas.fonts.size).toBe(1);
    });

    test("is the newest version when no emoji draws in colour", async () => {
        stubCanvas([]);
        const { getEmojiSupportLevel } = await import("./emojis");

        expect(getEmojiSupportLevel()).toBe(15.1);
    });

    test("is the newest version when there's no canvas to check with", async () => {
        stubCanvas(null);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { getEmojiSupportLevel } = await import("./emojis");

        expect(getEmojiSupportLevel()).toBe(15.1);
    });

    test("is only checked once", async () => {
        stubCanvas(["😀"]);
        const { getEmojiSupportLevel } = await import("./emojis");
        getEmojiSupportLevel();
        const contexts = vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length;

        expect(getEmojiSupportLevel()).toBe(1);
        expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(contexts);
    });

    // Invariant: the check matches emoji-picker-element's own, so the picker shows the same emoji
    // as it would have. An upgrade that changes the library's test emoji or fonts, or adds an x.1
    // version with no joined emoji to measure, fails here.
    test("tests the same emoji, in the same order, with the same fonts as emoji-picker-element", async () => {
        const library = libraryEmojiSupportCheck();
        expect(library.versions.length).toBeGreaterThan(10);

        const canvas = stubCanvas([]);
        const { getEmojiSupportLevel } = await import("./emojis");
        expect(getEmojiSupportLevel()).toBe(library.versions[0][1]);
        expect(canvas.drawn).toEqual(library.versions.map(([emoji]) => emoji));
        expect([...canvas.fonts]).toEqual([`100px ${library.fontFamily}`]);

        for (const [emoji, version] of library.versions) {
            vi.resetModules();
            vi.restoreAllMocks();
            stubCanvas([emoji]);
            const { getEmojiSupportLevel } = await import("./emojis");
            expect(getEmojiSupportLevel()).toBe(version);

            // x.1 versions (from 12.1 on) only add joined emoji, which a font without them draws
            // as two side by side
            vi.resetModules();
            vi.restoreAllMocks();
            const canvas = stubCanvas([emoji], (measured) => measured !== "😀");
            const { getEmojiSupportLevel: withJoinedDrawnAsTwo } = await import("./emojis");
            const joinedOnly = version > 1 && !Number.isInteger(version);
            expect(withJoinedDrawnAsTwo()).toBe(joinedOnly ? Math.floor(version) : version);
            expect([...canvas.fonts]).toEqual([`100px ${library.fontFamily}`]);
        }
    });
});
