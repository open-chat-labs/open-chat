import { emojiGroupNames, PremiumItem, premiumPrices, type CustomEmoji } from "@client";

// OpenChat's own (custom) emoji in a composer's emoji picker, as the old trees' picker offers them
// (components/home/EmojiPicker): by pack, each a premium item that's locked until it's bought with
// CHIT, and found by a search of their codes.

/** A pack of custom emoji (a premium item), as a picker shows it. */
export type CustomEmojiPack = {
    item: PremiumItem;
    /** The old picker's heading for it (not translated there either). */
    name: string;
    /** In CHIT. */
    price: number;
    /** Not bought yet: picking one offers to buy the pack. */
    locked: boolean;
    emoji: CustomEmoji[];
};

/** The custom emoji packs (bots, then popular, as the old picker), each with its emoji in order. */
export function customEmojiPacks(
    all: ReadonlyMap<string, CustomEmoji>,
    owned: ReadonlySet<PremiumItem>,
): CustomEmojiPack[] {
    return [PremiumItem.BotEmojis, PremiumItem.PopularEmojis].flatMap((item) => {
        const emoji = [...all.values()].filter((e) => e.premiumItem === item);
        if (emoji.length === 0) return [];
        return [
            {
                item,
                name: emojiGroupNames[item],
                price: premiumPrices[item],
                locked: !owned.has(item),
                emoji,
            },
        ];
    });
}

/**
 * The custom emoji whose code has what's typed in it (as the old trees' `searchCustomEmojis`, but
 * locked ones too, as the old picker shows them); none for nothing typed.
 */
export function customEmojiMatching(
    query: string,
    all: ReadonlyMap<string, CustomEmoji>,
): CustomEmoji[] {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    return [...all.values()].filter((e) => e.code.toLowerCase().includes(q));
}

/** A custom emoji in a message's markdown: what the rich-text editor writes for one, and reads. */
export function customEmojiText(code: string): string {
    return `!emoji(${code})`;
}
