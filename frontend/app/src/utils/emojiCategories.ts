import type { Emoji, NativeEmoji, SkinTone } from "emoji-picker-element/shared";

// An emoji picker's categories and what it shows in each, from the emoji data the app's pickers
// share (emoji-picker-element's Database, utils/emojis.ts).

/** A picker's categories, in emoji-picker-element's order (its groups, but the skin tones'). */
export const EMOJI_CATEGORIES = [
    { group: 0, icon: "😀", name: "smileys" },
    { group: 1, icon: "👋", name: "people" },
    { group: 3, icon: "🐱", name: "animals" },
    { group: 4, icon: "🍎", name: "food" },
    { group: 5, icon: "🏠", name: "travel" },
    { group: 6, icon: "⚽", name: "activities" },
    { group: 7, icon: "💡", name: "objects" },
    { group: 8, icon: "🔣", name: "symbols" },
    { group: 9, icon: "🏁", name: "flags" },
] as const;

export type EmojiCategory = (typeof EMOJI_CATEGORIES)[number];

/** An emoji as a picker shows it: in the user's skin tone, counted as used by its base. */
export type PickerEmoji = {
    /** What's shown and typed. */
    char: string;
    /** The emoji without a skin tone, which its use is counted by. */
    base: string;
    /** Its name, for screen readers. */
    name: string;
};

/**
 * Emoji as a picker shows them: only those the device draws (up to the `supported` version), each
 * in the skin tone chosen where it has one. Custom emoji aren't shown.
 */
export function pickerEmoji(
    emoji: readonly Emoji[],
    supported: number,
    tone: SkinTone,
): PickerEmoji[] {
    return emoji.filter(isNative).flatMap((e) => {
        if (e.version > supported) return [];
        const skin = tone > 0 ? e.skins?.find((s) => s.tone === tone) : undefined;
        const char = skin !== undefined && skin.version <= supported ? skin.unicode : e.unicode;
        return [{ char, base: e.unicode, name: e.annotation }];
    });
}

function isNative(emoji: Emoji): emoji is NativeEmoji {
    return "unicode" in emoji;
}
