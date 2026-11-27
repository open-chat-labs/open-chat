import { PremiumItem, type CustomEmoji } from "@client";
import type { CustomEmojiPack } from "@src/logic/composer/customEmoji";
import { EMOJI_CATEGORIES } from "@src/utils/emojiCategories";
import { describe, expect, test, vi } from "vitest";
import { composerEmojiSource, type ComposerEmojiInput } from "./composerEmoji.adapter";

const robot: CustomEmoji = {
    kind: "custom",
    code: "bots_robot",
    url: "/assets/emoji/bots/robot.gif",
    filename: "robot.gif",
    premiumItem: PremiumItem.BotEmojis,
};
const cat: CustomEmoji = { ...robot, code: "popular_cat", premiumItem: PremiumItem.PopularEmojis };

const pack = (emoji: CustomEmoji, locked: boolean): CustomEmojiPack => ({
    item: emoji.premiumItem,
    name: `pack ${emoji.premiumItem}`,
    price: 10,
    locked,
    emoji: [emoji],
});

function input(over: Partial<ComposerEmojiInput> = {}): ComposerEmojiInput {
    return {
        recent: ["👍"],
        categories: EMOJI_CATEGORIES.map(() => undefined),
        loading: true,
        failed: false,
        packs: [pack(robot, true), pack(cat, false)],
        customMatches: undefined,
        matches: undefined,
        labels: {
            recent: "Recent",
            categories: Object.fromEntries(
                EMOJI_CATEGORIES.map((c) => [c.name, c.name.toUpperCase()]),
            ) as ComposerEmojiInput["labels"]["categories"],
            unavailable: "unavailable",
            categoriesBar: "Categories",
            price: (chit) => `${chit} CHIT`,
        },
        onQuery: vi.fn(),
        onOpen: vi.fn(),
        ...over,
    };
}

describe("composerEmojiSource", () => {
    test("Recent, the custom packs, then the categories", () => {
        const source = composerEmojiSource(input());
        expect(source.sections.map((s) => s.id)).toEqual([
            "recent",
            `pack-${PremiumItem.BotEmojis}`,
            `pack-${PremiumItem.PopularEmojis}`,
            ...EMOJI_CATEGORIES.map((c) => c.name),
        ]);
        expect(source.sections[0].items).toEqual([{ kind: "char", char: "👍", name: "👍" }]);
        expect(source.sections[3].label).toBe("SMILEYS");
        expect(source.categoriesLabel).toBe("Categories");
    });

    test("a custom emoji goes in as the editor's markdown for it, locked with its pack", () => {
        const [, bots, popular] = composerEmojiSource(input()).sections;
        expect(bots.items).toEqual([
            {
                kind: "image",
                code: "bots_robot",
                url: robot.url,
                name: "bots_robot",
                text: "!emoji(bots_robot)",
                locked: true,
            },
        ]);
        expect(bots.lockedNote).toBe("10 CHIT");
        expect(popular.lockedNote).toBeUndefined();
        expect(popular.items[0]).toMatchObject({ kind: "image", locked: false });
    });

    test("loading, failed, then ready", () => {
        expect(composerEmojiSource(input()).status).toEqual({ kind: "loading" });
        expect(composerEmojiSource(input({ failed: true })).status).toEqual({
            kind: "failed",
            text: "unavailable",
        });
        const ready = composerEmojiSource(
            input({
                loading: false,
                categories: EMOJI_CATEGORIES.map(() => [{ char: "😀", base: "😀", name: "grin" }]),
            }),
        );
        expect(ready.status).toEqual({ kind: "ready" });
        expect(ready.sections[3].items).toEqual([{ kind: "char", char: "😀", name: "grin" }]);
    });

    test("no search, no matches", () => {
        expect(composerEmojiSource(input({ matches: [] })).matches).toBeUndefined();
    });

    test("custom emoji found show before the others are in", () => {
        const source = composerEmojiSource(input({ customMatches: [robot] }));
        expect(source.matches?.map((m) => m.kind === "image" && m.code)).toEqual(["bots_robot"]);
    });

    test("nothing found yet is no answer yet, not none", () => {
        expect(composerEmojiSource(input({ customMatches: [] })).matches).toBeUndefined();
        expect(composerEmojiSource(input({ customMatches: [], matches: [] })).matches).toEqual([]);
    });

    test("custom emoji first, then the others", () => {
        const source = composerEmojiSource(
            input({ customMatches: [cat], matches: [{ char: "🐱", base: "🐱", name: "cat" }] }),
        );
        expect(source.matches).toEqual([
            expect.objectContaining({ kind: "image", code: "popular_cat", locked: false }),
            { kind: "char", char: "🐱", name: "cat" },
        ]);
    });
});
