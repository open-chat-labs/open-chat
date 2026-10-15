import { Database } from "emoji-picker-element";
import type { EmojiSkin, NativeEmoji } from "emoji-picker-element/shared";
import {
    type CustomEmojiSummary,
    type EmojiSummary,
    type NativeEmojiSummary,
    type SelectedEmoji,
    customEmojis as allCustomEmojis,
    premiumItemsStore,
} from "@client";

const emojiSet = new Set<string>();
const emojiRegex = /^\p{Extended_Pictographic}$/u;
let initializing = false;

let database: Database | undefined;

// Constructing a Database immediately opens IndexedDB and fires an ETag request
// at the emoji CDN, so build it lazily and share the single instance.
// A Database whose first load fails (eg. the CDN errors while IndexedDB is still
// empty) rejects every later call, so drop it and build a fresh one next time.
export function getEmojiDatabase(): Database {
    if (database === undefined) {
        const db = (database = new Database());
        db.ready().catch(() => {
            if (database === db) {
                database = undefined;
            }
        });
    }
    return database;
}

// The fonts emoji-picker-element draws emoji with, and the emoji it tests to find the newest emoji
// version the device can draw (one per version, newest first). Copied from its picker.js, which
// emojis.spec.ts checks, so a library upgrade that changes them fails the tests.
const EMOJI_FONT_FAMILY =
    '"Twemoji Mozilla","Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol",' +
    '"Noto Color Emoji","EmojiOne Color","Android Emoji",sans-serif';
const versionTestEmojis: [string, number][] = [
    ["🫨", 15.1],
    ["🫠", 14],
    ["🥲", 13.1],
    ["🥻", 12.1],
    ["🥰", 11],
    ["🤩", 5],
    ["\u{1F471}‍♀️", 4], // 👱‍♀️
    ["🤣", 3],
    ["\u{1F441}️‍\u{1F5E8}️", 2], // 👁️‍🗨️
    ["😀", 1],
    ["\u{1F610}️", 0.7], // 😐️
    ["😃", 0.6],
];

let emojiSupportLevel: number | undefined;

// emoji-picker-element shows no emoji until it has worked out which emoji version the device
// supports, and it only does that in a requestIdleCallback with no timeout. Just after a cold start
// the app can keep the main thread busy for long enough that the picker opens empty. So the pickers
// make the same check here instead, synchronously and once, and pass the result in as their
// emojiVersion, which skips the library's own check.
export function getEmojiSupportLevel(): number {
    emojiSupportLevel ??= detectEmojiSupportLevel();
    return emojiSupportLevel;
}

function detectEmojiSupportLevel(): number {
    try {
        const supported = versionTestEmojis.find(([emoji]) => drawsInColour(emoji));
        if (supported !== undefined) {
            return supported[1];
        }
    } catch (err) {
        console.warn("Failed to check which emoji versions are supported: ", err);
    }
    // Like the library, assume every emoji is supported if none draw in colour or the canvas fails
    // (eg. blocked by an anti-fingerprinting extension): grey boxes are better than no emoji
    return versionTestEmojis[0][1];
}

// A colour emoji comes out the same whatever the text colour, and isn't black
function drawsInColour(emoji: string): boolean {
    const inBlack = drawnPixel(emoji, "#000");
    return inBlack === drawnPixel(emoji, "#fff") && !inBlack.startsWith("0,0,0,");
}

// The RGBA of the emoji drawn 100px high and then scaled down to a single pixel
function drawnPixel(emoji: string, textColour: string): string {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error("No 2d canvas context");
    }
    ctx.textBaseline = "top";
    ctx.font = `100px ${EMOJI_FONT_FAMILY}`;
    ctx.fillStyle = textColour;
    ctx.scale(0.01, 0.01);
    ctx.fillText(emoji, 0, 0);
    return ctx.getImageData(0, 0, 1, 1).data.join(",");
}

const customEmojiRegex = /^!emoji\([^)]+\)$/;

export function summaryToSelectedEmoji(match: EmojiSummary): SelectedEmoji {
    if (match.kind === "native") {
        return { kind: "native", unicode: match.unicode };
    }
    return allCustomEmojis.get(match.code)!;
}

export function searchAllEmojis(query: string) {
    const db = getEmojiDatabase();
    return db
        .getPreferredSkinTone()
        .then((tone) => {
            return db.getEmojiBySearchQuery(query!).then((m) => {
                const native: NativeEmojiSummary[] = (m as NativeEmoji[])
                    .filter((m) => m.version < 14)
                    .map((match) => {
                        const unicode =
                            match.skins?.find((s) => s.tone === tone)?.unicode ?? match.unicode;
                        return {
                            kind: "native" as const,
                            unicode,
                            code: match.shortcodes
                                ? match.shortcodes[match.shortcodes.length - 1]
                                : match.annotation,
                        };
                    });
                return [...searchCustomEmojis(query), ...native];
            });
        })
        .catch((err) => {
            // the emoji database can transiently fail if the browser has closed the
            // IndexedDB connection (eg. Android backgrounding the app)
            console.error("Emoji search failed: ", err);
            return searchCustomEmojis(query);
        });
}

export function searchCustomEmojis(query: string): CustomEmojiSummary[] {
    const lower = query.toLowerCase();
    return [...allCustomEmojis.values()]
        .filter(
            (e) =>
                premiumItemsStore.value.has(e.premiumItem) && e.code.toLowerCase().includes(lower),
        )
        .map((e) => ({ kind: "custom", url: e.url, code: e.code }));
}

export function isSingleEmoji(text: string): boolean {
    if (customEmojiRegex.test(text)) return true;
    initEmojiSet();
    return emojiSet.has(text) || emojiRegex.test(text);
}

// Reads the whole emoji table out of IndexedDB so that multi-codepoint sequences
// (ZWJ, skin tones, flags) can be recognised - the regex above only matches a
// single Extended_Pictographic character. Kicked off by the first isSingleEmoji
// call rather than at module load. TODO: replace the set with /^\p{RGI_Emoji}$/v
// once we have confirmed support in the Tauri WebViews.
function initEmojiSet(): void {
    if (emojiSet.size > 0 || initializing) return;
    initializing = true;

    getAllNativeEmojis()
        .then((emojis: NativeEmoji[]) => {
            emojis.forEach((e: NativeEmoji) => {
                emojiSet.add(e.unicode);
                e.skins?.forEach((s: EmojiSkin) => emojiSet.add(s.unicode));
            });
        })
        .catch((err: Error) => {
            console.error("Failed to initialize emoji database:", err);
        })
        .finally(() => (initializing = false));
}

function getAllNativeEmojis(): Promise<NativeEmoji[]> {
    const emojiDb = getEmojiDatabase();
    return emojiDb.ready().then(
        () =>
            new Promise<NativeEmoji[]>((resolve, reject) => {
                const request = indexedDB.open("emoji-picker-element-en");

                request.onerror = () =>
                    reject(request.error ?? new Error("Failed to open emoji database"));

                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction("emoji", "readonly");
                    const store = transaction.objectStore("emoji");
                    const index = store.index("group-order");
                    const getAllRequest = index.getAll();

                    getAllRequest.onerror = () => {
                        db.close();
                        reject(getAllRequest.error ?? new Error("Failed to read emoji database"));
                    };

                    getAllRequest.onsuccess = () => {
                        db.close();
                        resolve(getAllRequest.result as NativeEmoji[]);
                    };
                };
            }),
    );
}
