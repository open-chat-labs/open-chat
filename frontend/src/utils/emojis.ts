import { Database } from "emoji-picker-element";

const emojiRegex = /^\p{Emoji}$/u;

export const emojiDatabase = new Database();

export function isSingleEmoji(text: string): boolean {
    return emojiRegex.test(text);
}
