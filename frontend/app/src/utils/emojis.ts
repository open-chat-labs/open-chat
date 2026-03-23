import { Database } from "emoji-picker-element";
import type { NativeEmoji, EmojiSkin } from "emoji-picker-element/shared";

declare module "emoji-picker-element" {
    interface Database {
        getAllNativeEmojis(): Promise<NativeEmoji[]>;
    }
}

const emojiSet = new Set<string>();
const emojiRegex = /^\p{Extended_Pictographic}$/u;
let initializing = false;

export const emojiDatabase = new Database();

export function isSingleEmoji(text: string): boolean {
    initEmojiSet();
    return emojiSet.has(text) || emojiRegex.test(text);
}

function initEmojiSet(): void {
    if (emojiSet.size > 0 || initializing) return;
    initializing = true;

    emojiDatabase
        .getAllNativeEmojis()
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
