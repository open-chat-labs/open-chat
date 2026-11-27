import { PremiumItem, type CustomEmoji } from "@client";
import { markdownToDoc } from "@src/core/richText/markdownConversion";
import { describe, expect, test } from "vitest";
import { customEmojiMatching, customEmojiPacks, customEmojiText } from "./customEmoji";

const emoji = (code: string, premiumItem: PremiumItem): CustomEmoji => ({
    kind: "custom",
    code,
    url: `/assets/emoji/${code}.gif`,
    filename: `${code}.gif`,
    premiumItem,
});

const all = new Map(
    [
        emoji("popular_cat", PremiumItem.PopularEmojis),
        emoji("bots_robot", PremiumItem.BotEmojis),
        emoji("popular_dog", PremiumItem.PopularEmojis),
        emoji("bots_Catbot", PremiumItem.BotEmojis),
    ].map((e) => [e.code, e]),
);

describe("customEmojiPacks", () => {
    test("bots first, then popular, each with its own emoji in order", () => {
        const packs = customEmojiPacks(all, new Set<PremiumItem>());
        expect(packs.map((p) => [p.item, p.name, p.price])).toEqual([
            [PremiumItem.BotEmojis, "OC Bots", 10_000],
            [PremiumItem.PopularEmojis, "Popular", 50_000],
        ]);
        expect(packs[0].emoji.map((e) => e.code)).toEqual(["bots_robot", "bots_Catbot"]);
        expect(packs[1].emoji.map((e) => e.code)).toEqual(["popular_cat", "popular_dog"]);
    });

    test("a pack is locked until it's bought", () => {
        const packs = customEmojiPacks(all, new Set([PremiumItem.PopularEmojis]));
        expect(packs.map((p) => p.locked)).toEqual([true, false]);
    });

    test("a pack with no emoji isn't offered", () => {
        const popular = new Map([...all].filter(([code]) => code.startsWith("popular")));
        expect(customEmojiPacks(popular, new Set<PremiumItem>()).map((p) => p.item)).toEqual([
            PremiumItem.PopularEmojis,
        ]);
    });
});

describe("customEmojiMatching", () => {
    test("matches the code, whatever the case, locked or not", () => {
        expect(customEmojiMatching(" CAT ", all).map((e) => e.code)).toEqual([
            "popular_cat",
            "bots_Catbot",
        ]);
    });

    test("nothing typed finds none", () => {
        expect(customEmojiMatching("  ", all)).toEqual([]);
    });
});

describe("customEmojiText", () => {
    test("is the markdown the editor reads back as a custom emoji", () => {
        const doc = markdownToDoc(`hi ${customEmojiText("bots_robot")}`);
        expect(JSON.stringify(doc)).toContain('"type":"custom_emoji","attrs":{"id":"bots_robot"}');
    });
});
