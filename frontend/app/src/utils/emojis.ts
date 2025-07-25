import { Database } from "emoji-picker-element";

const emojiSet = new Set<string>();
const emojiRegex = /^\p{Extended_Pictographic}$/u;
let initializing = false;

export const emojiDatabase = new Database();

export function isSingleEmoji(text: string): boolean {
    initEmojiSet();
    return emojiSet.has(text) || emojiRegex.test(text);
}

function initEmojiSet() {
    if (emojiSet.size > 0 || initializing) return;
    initializing = true;

    emojiDatabase
        .getAllNativeEmojis()
        .then((emojis) =>
            emojis.forEach((e) => {
                emojiSet.add(e.unicode);
                e.skins?.forEach((s) => emojiSet.add(s.unicode));
            }),
        )
        .finally(() => (initializing = false));
}

initEmojiSet();
