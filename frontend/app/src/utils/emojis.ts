import { Database } from "emoji-picker-element";

export const emojiDatabase = new Database();

export async function isSingleEmoji(text: string): Promise<boolean> {
    return (await emojiDatabase.getEmojiByUnicodeOrName(text)) !== null;
}
