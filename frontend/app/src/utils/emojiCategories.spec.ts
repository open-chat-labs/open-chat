import type { CustomEmoji, NativeEmoji, SkinTone } from "emoji-picker-element/shared";
import { pickerEmoji } from "./emojiCategories";

function emoji(unicode: string, version: number, skins?: NativeEmoji["skins"]): NativeEmoji {
    return { annotation: `name of ${unicode}`, group: 1, name: unicode, order: 1, version, unicode, skins };
}

const DEFAULT = 0 as SkinTone;
const DARK = 5 as SkinTone;

describe("the emoji a picker shows", () => {
    test("are those the device draws", () => {
        const shown = pickerEmoji([emoji("😀", 1), emoji("🫨", 15)], 14, DEFAULT);
        expect(shown).toEqual([{ char: "😀", base: "😀", name: "name of 😀" }]);
    });

    test("are in the chosen skin tone where they have one, counted by their base", () => {
        const wave = emoji("👋", 1, [
            { tone: 1 as SkinTone, unicode: "👋🏻", version: 1 },
            { tone: DARK, unicode: "👋🏿", version: 1 },
        ]);
        expect(pickerEmoji([wave, emoji("😀", 1)], 14, DARK).map((e) => [e.char, e.base])).toEqual(
            [
                ["👋🏿", "👋"],
                ["😀", "😀"],
            ],
        );
        expect(pickerEmoji([wave], 14, DEFAULT)[0].char).toBe("👋");
    });

    test("leave custom emoji out", () => {
        const custom: CustomEmoji = { name: "party", shortcodes: ["party"], url: "x.png" };
        expect(pickerEmoji([custom, emoji("😀", 1)], 14, DEFAULT).map((e) => e.char)).toEqual([
            "😀",
        ]);
    });
});
