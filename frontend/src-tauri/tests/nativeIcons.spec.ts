import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONS, iconSvg } from "../../openchat-ui/src/lib/icons.js";
import { imagesetContents, iosIconNames } from "../scripts/ios-icons.mjs";

// The iOS call screen draws the v3 icon set, as the web and Android call screens do (#10529). Its
// glyphs are copies of icons.js in the app's asset catalog, so a copy that's missing draws nothing
// and one that's stale draws a different icon from the other platforms.

const apple = join(__dirname, "../gen/apple");
const callScreen = readFileSync(join(apple, "Sources/open-chat/NativeCallScreen.swift"), "utf8");
const names = iosIconNames(callScreen);

test("the iOS call screen draws only the v3 icon set's glyphs", () => {
    expect(names.length).toBeGreaterThan(0);
    // iconSvg draws an unknown name as the search icon
    expect(names.filter((name) => !(name in ICONS))).toEqual([]);
    expect(callScreen).not.toContain("systemName:");
});

test("each glyph the iOS call screen draws is icons.js's, as a template imageset", () => {
    for (const name of names) {
        const set = join(apple, `Assets.xcassets/oc-${name}.imageset`);
        expect(existsSync(set), `run node src-tauri/scripts/ios-icons.mjs (${name})`).toBe(true);
        expect(readFileSync(join(set, `${name}.svg`), "utf8"), name).toBe(iconSvg(name));
        expect(readFileSync(join(set, "Contents.json"), "utf8"), name).toBe(imagesetContents(name));
    }
});
