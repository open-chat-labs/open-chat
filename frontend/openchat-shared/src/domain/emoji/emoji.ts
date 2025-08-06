import { files as botEmojiFiles } from "./bots";
import { files as popularEmojiFiles } from "./popular";

export type NativeEmoji = {
    kind: "native";
    unicode: string;
};

export const emojiGroupNames: Record<number, string> = {
    1: "Cheap",
    2: "Worth it",
    3: "Ultimate flex",
};

export type CustomEmoji = {
    kind: "custom";
    code: string;
    url: string;
    groupId: number;
};

export type SelectedEmoji = NativeEmoji | CustomEmoji;

function filenameToEmoji(dir: string, filename: string, groupId: number): CustomEmoji {
    const [code] = filename.split(".");
    return {
        kind: "custom",
        code: `${dir}_${code}`,
        groupId,
        url: `/assets/emoji/${dir}/${filename}`,
    };
}

const botEmojis = botEmojiFiles.map((e) => filenameToEmoji("bots", e, 1));
const popularEmojis = popularEmojiFiles.map((e) => filenameToEmoji("popular", e, 2));

export const customEmojis = new Map([...botEmojis, ...popularEmojis].map((e) => [e.code, e]));
