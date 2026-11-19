// Writes the iOS app's copies of the v3 icons its native screens draw: one template imageset per
// case of NativeCallScreen.swift's OCIcon, from openchat-ui's lib/icons.js, and removes the ones no
// case names. Run after changing OCIcon or icons.js: node src-tauri/scripts/ios-icons.mjs
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { iconSvg } from "../../openchat-ui/src/lib/icons.js";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "../..");
const apple = join(frontend, "src-tauri/gen/apple");
const assets = join(apple, "Assets.xcassets");

export function iosIconNames(swift) {
    const body = swift.match(/enum OCIcon: String \{([^}]*)\}/)?.[1] ?? "";
    return [...body.matchAll(/case \w+ = "([a-z0-9-]+)"/g)].map((m) => m[1]);
}

export function imagesetContents(name) {
    return (
        JSON.stringify(
            {
                images: [{ filename: `${name}.svg`, idiom: "universal" }],
                info: { author: "xcode", version: 1 },
                properties: {
                    "preserves-vector-representation": true,
                    "template-rendering-intent": "template",
                },
            },
            null,
            2,
        ) + "\n"
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const names = iosIconNames(
        readFileSync(join(apple, "Sources/open-chat/NativeCallScreen.swift"), "utf8"),
    );
    for (const set of readdirSync(assets).filter(
        (d) => d.startsWith("oc-") && d.endsWith(".imageset"),
    )) {
        rmSync(join(assets, set), { recursive: true });
    }
    for (const name of names) {
        const dir = join(assets, `oc-${name}.imageset`);
        mkdirSync(dir);
        writeFileSync(join(dir, `${name}.svg`), iconSvg(name));
        writeFileSync(join(dir, "Contents.json"), imagesetContents(name));
    }
    console.log(`wrote ${names.length} icons`);
}
