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

export const emojiDatabase = new Database();

const customEmojiRegex = /^!emoji\([^)]+\)$/;

export function summaryToSelectedEmoji(match: EmojiSummary): SelectedEmoji {
    if (match.kind === "native") {
        return { kind: "native", unicode: match.unicode };
    }
    return allCustomEmojis.get(match.code)!;
}

export function searchAllEmojis(query: string) {
    return emojiDatabase.getPreferredSkinTone().then((tone) => {
        return emojiDatabase.getEmojiBySearchQuery(query!).then((m) => {
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

// Initial call to start the async process
initEmojiSet();

function getAllNativeEmojis(): Promise<NativeEmoji[]> {
    return emojiDatabase.ready().then(
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
