import type { CustomEmoji } from "@client";
import type {
    EmojiPickerSource,
    PickerEmojiItem,
    PickerEmojiSection,
} from "@openchat/ui/src/lib/types";
import { customEmojiText, type CustomEmojiPack } from "@src/logic/composer/customEmoji";
import { EMOJI_CATEGORIES, type PickerEmoji } from "@src/utils/emojiCategories";

// The composer's emoji picker's emoji (the library's EmojiPicker `source`): Recent, the custom
// emoji packs, then every emoji the device draws by category (EmojiSections'), and what a search
// found, custom emoji first (as the old trees' search).

/** What the picker shows, as the app has it. */
export type ComposerEmojiInput = {
    /** Recent, newest first (EmojiSections'). */
    recent: readonly string[];
    /** EMOJI_CATEGORIES' emoji, each undefined until it's in. */
    categories: readonly (readonly PickerEmoji[] | undefined)[];
    loading: boolean;
    failed: boolean;
    packs: readonly CustomEmojiPack[];
    /** What the search found (none while there's no search): custom emoji, then the others once in. */
    customMatches: readonly CustomEmoji[] | undefined;
    matches: readonly PickerEmoji[] | undefined;
    /** Translated. */
    labels: {
        recent: string;
        /** By EMOJI_CATEGORIES' name. */
        categories: Record<(typeof EMOJI_CATEGORIES)[number]["name"], string>;
        unavailable: string;
        categoriesBar: string;
        /** A locked pack's price, after its heading. */
        price: (chit: number) => string;
    };
    onQuery: (query: string) => void;
    onOpen: () => void;
};

/** The emoji the composer's picker offers. */
export function composerEmojiSource(input: ComposerEmojiInput): EmojiPickerSource {
    const { labels } = input;
    const sections: PickerEmojiSection[] = [
        {
            id: "recent",
            label: labels.recent,
            icon: { kind: "char", char: "🕘", name: labels.recent },
            items: input.recent.map((char) => ({ kind: "char", char, name: char })),
        },
        ...input.packs.map(
            (pack): PickerEmojiSection => ({
                id: `pack-${pack.item}`,
                label: pack.name,
                icon: customItem(pack.emoji[0], pack.locked),
                lockedNote: pack.locked ? labels.price(pack.price) : undefined,
                items: pack.emoji.map((e) => customItem(e, pack.locked)),
            }),
        ),
        ...EMOJI_CATEGORIES.map(
            (category, i): PickerEmojiSection => ({
                id: category.name,
                label: labels.categories[category.name],
                icon: { kind: "char", char: category.icon, name: labels.categories[category.name] },
                items: (input.categories[i] ?? []).map(charItem),
            }),
        ),
    ];
    return {
        sections,
        status: input.failed
            ? { kind: "failed", text: labels.unavailable }
            : input.loading
              ? { kind: "loading" }
              : { kind: "ready" },
        matches: matches(input),
        onQuery: input.onQuery,
        onOpen: input.onOpen,
        categoriesLabel: labels.categoriesBar,
    };
}

// custom emoji found show at once; with none, nothing's shown until the others are in (not "no
// emoji for …" before the search has run)
function matches(input: ComposerEmojiInput): PickerEmojiItem[] | undefined {
    if (input.customMatches === undefined) return undefined;
    const locked = new Set(input.packs.filter((p) => p.locked).map((p) => p.item));
    const custom = input.customMatches.map((e) => customItem(e, locked.has(e.premiumItem)));
    if (input.matches === undefined) return custom.length > 0 ? custom : undefined;
    return [...custom, ...input.matches.map(charItem)];
}

function charItem(emoji: PickerEmoji): PickerEmojiItem {
    return { kind: "char", char: emoji.char, name: emoji.name };
}

function customItem(emoji: CustomEmoji, locked: boolean): PickerEmojiItem {
    return {
        kind: "image",
        code: emoji.code,
        url: emoji.url,
        name: emoji.code,
        text: customEmojiText(emoji.code),
        locked,
    };
}
