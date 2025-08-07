import { PremiumItem } from "../chit";
import { files as botEmojiFiles } from "./bots";
import { files as popularEmojiFiles } from "./popular";

export type NativeEmoji = {
    kind: "native";
    unicode: string;
};

export const emojiGroupNames: Record<number, string> = {
    0: "Cheap",
    1: "Worth it",
    2: "Ultimate flex",
};

export type CustomEmoji = {
    kind: "custom";
    code: string;
    url: string;
    filename: string;
    premiumItem: PremiumItem;
};

export type SelectedEmoji = NativeEmoji | CustomEmoji;

function filenameToEmoji(dir: string, filename: string, premiumItem: PremiumItem): CustomEmoji {
    const [code] = filename.split(".");
    return {
        kind: "custom",
        code: `${dir}_${code}`,
        premiumItem,
        filename,
        url: `/assets/emoji/${dir}/${filename}`,
    };
}

const botEmojis = [...botEmojiFiles].map((e) => filenameToEmoji("bots", e, PremiumItem.BotEmojis));
const popularEmojis = [...popularEmojiFiles].map((e) =>
    filenameToEmoji("popular", e, PremiumItem.PopularEmojis),
);

export const customEmojis = new Map([...botEmojis, ...popularEmojis].map((e) => [e.code, e]));
