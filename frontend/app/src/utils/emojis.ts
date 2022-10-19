import { Database } from "emoji-picker-element";

export const emojiDatabase = new Database();

export async function isSingleEmoji(text: string): Promise<boolean> {
    return text.length > 0 && (await emojiDatabase.getEmojiByUnicodeOrName(text)) !== null;
}
