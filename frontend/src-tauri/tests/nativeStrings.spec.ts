import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The native shells' own text (notifications, notification channels, the incoming call screen,
// the share extension) is translated with each platform's string resources, in the system
// language. A language missing a key, or a translation missing a placeholder, shows English or
// garbled text only on that language's devices, so nothing else would catch it.

const frontend = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(frontend, p), "utf8");
const dirs = (p: string) =>
    readdirSync(join(frontend, p), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

// The web app's language codes that aren't the platforms'
const PLATFORM_CODE: Record<string, string> = { cn: "zh", iw: "he", jp: "ja" };
const appLanguages = readdirSync(join(frontend, "app/src/i18n"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .map((code) => PLATFORM_CODE[code] ?? code)
    .sort();

const placeholders = (s: string) => [...s.matchAll(/%(\d+\$)?[sd@]/g)].map((m) => m[0]).sort();

// --- Android ---

const ANDROID_RES = "tauri-plugin-oc/android/src/main/res";
// values-zh-rCN → zh, values-iw (Android's code for Hebrew) → he
const androidLanguage = (dir: string) => {
    const code = dir.replace(/^values-/, "").replace(/-r[A-Z]+$/, "");
    return code === "iw" ? "he" : code;
};

type AndroidStrings = { strings: Map<string, string>; plurals: Map<string, Map<string, string>> };

function androidStrings(dir: string): AndroidStrings {
    const doc = new DOMParser().parseFromString(
        read(`${ANDROID_RES}/${dir}/strings.xml`),
        "application/xml",
    );
    expect(doc.querySelector("parsererror"), dir).toBeNull();
    const strings = new Map(
        [...doc.querySelectorAll("resources > string")].map((s) => [
            s.getAttribute("name")!,
            s.textContent ?? "",
        ]),
    );
    const plurals = new Map(
        [...doc.querySelectorAll("resources > plurals")].map((p) => [
            p.getAttribute("name")!,
            new Map(
                [...p.querySelectorAll("item")].map((i) => [
                    i.getAttribute("quantity")!,
                    i.textContent ?? "",
                ]),
            ),
        ]),
    );
    return { strings, plurals };
}

const androidLocales = dirs(ANDROID_RES).filter(
    (d) => d.startsWith("values-") && !d.startsWith("values-night"),
);

describe("Android native strings", () => {
    const base = androidStrings("values");

    test("cover every language the app has", () => {
        expect(["en", ...androidLocales.map(androidLanguage)].sort()).toEqual(appLanguages);
    });

    test.each(androidLocales)("%s has every key, with the same placeholders", (dir) => {
        const locale = androidStrings(dir);
        expect([...locale.strings.keys()].sort()).toEqual([...base.strings.keys()].sort());
        expect([...locale.plurals.keys()].sort()).toEqual([...base.plurals.keys()].sort());

        for (const [name, english] of base.strings) {
            expect(placeholders(locale.strings.get(name)!), `${dir} ${name}`).toEqual(
                placeholders(english),
            );
        }
        // A quantity may leave its number out ("one message"), but `other` is the fallback for
        // every quantity a language doesn't list, so it has them all
        for (const [name, english] of base.plurals) {
            const expected = placeholders(english.get("other")!);
            const items = locale.plurals.get(name)!;
            expect(placeholders(items.get("other") ?? ""), `${dir} ${name}`).toEqual(expected);
            for (const [quantity, text] of items) {
                for (const p of placeholders(text)) {
                    expect(expected, `${dir} ${name} ${quantity}`).toContain(p);
                }
            }
        }
    });
});

// --- iOS ---

// One table per target that shows text, and the Swift that looks its text up: the app
// (CallRinger, the call screen), the Notification Service Extension (PushCore's renderer) and
// the share extension
const APPLE = "src-tauri/gen/apple";
const IOS_SOURCES: Record<string, string[]> = {
    [`${APPLE}/open-chat_iOS`]: [`${APPLE}/Sources/open-chat`, "tauri-plugin-oc/ios/Sources"],
    [`${APPLE}/NotificationService`]: [
        `${APPLE}/NotificationService`,
        "tauri-plugin-oc/ios/PushCore/Sources",
    ],
    [`${APPLE}/ShareExtension`]: [`${APPLE}/ShareExtension`],
};
const IOS_TARGETS = Object.keys(IOS_SOURCES);

const swiftFiles = (dir: string): string[] =>
    readdirSync(join(frontend, dir), { withFileTypes: true }).flatMap((d) =>
        d.isDirectory()
            ? swiftFiles(`${dir}/${d.name}`)
            : d.name.endsWith(".swift")
              ? [`${dir}/${d.name}`]
              : [],
    );

// The literals the Swift looks up: NSLocalizedString, PushCore's localized(), and SwiftUI's
// LocalizedStringKey labels (accessibilityLabel, and the call screen's control(), whose label is its
// second argument; NativeCallBridge has an unrelated control(kind, on:))
const LOOKUPS = [
    /NSLocalizedString\("((?:[^"\\]|\\.)*)"/g,
    /\blocalized\("((?:[^"\\]|\\.)*)"/g,
    /\.accessibilityLabel\("((?:[^"\\]|\\.)*)"\)/g,
    /\bcontrol\(.*, "((?:[^"\\]|\\.)*)", on:/g,
];
const lookedUp = (target: string) =>
    IOS_SOURCES[target]
        .flatMap(swiftFiles)
        .flatMap((f) => LOOKUPS.flatMap((re) => [...read(f).matchAll(re)].map((m) => m[1])));

// The release builds from the committed project, so an .lproj xcodegen hasn't added to its
// target's Localizable.strings variant group never ships
const pbxproj = read(`${APPLE}/open-chat.xcodeproj/project.pbxproj`);
const pbxObjects = new Map(
    [
        ...pbxproj.matchAll(
            /^\t\t([0-9A-F]{24}) \/\*[^\n]*?\*\/ = \{(.*\};$|\n[\s\S]*?\n\t\t\};)/gm,
        ),
    ].map((m) => [m[1], m[2]]),
);
const pbxChildren = (body: string) =>
    [...(body.match(/children = \(([\s\S]*?)\);/)?.[1] ?? "").matchAll(/[0-9A-F]{24}/g)].map(
        (m) => m[0],
    );

function projectLprojs(target: string): string[] {
    const folder = target.split("/").pop()!;
    const group = [...pbxObjects.values()].find(
        (o) => o.includes("isa = PBXGroup;") && new RegExp(`path = "?${folder}"?;`).test(o),
    );
    expect(group, folder).toBeDefined();
    const variantId = pbxChildren(group!).find((id) =>
        /isa = PBXVariantGroup;[\s\S]*name = Localizable\.strings;/.test(pbxObjects.get(id) ?? ""),
    );
    expect(variantId, `${folder} Localizable.strings`).toBeDefined();
    expect(pbxproj, `${folder} Localizable.strings in Resources`).toMatch(
        new RegExp(`isa = PBXBuildFile; fileRef = ${variantId} `),
    );
    return pbxChildren(pbxObjects.get(variantId!)!)
        .map((id) => pbxObjects.get(id)?.match(/path = "?([^";]+)"?;/)?.[1] ?? id)
        .sort();
}
// zh-Hans → zh
const iosLanguage = (lproj: string) => lproj.replace(".lproj", "").replace(/-.*$/, "");

// iOS drops a whole .strings file it can't parse, so anything that isn't an entry or a comment
// fails here
function iosStrings(path: string): Map<string, string> {
    const entry = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
    const text = read(path).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(text.replace(entry, "").trim(), path).toBe("");
    return new Map([...text.matchAll(entry)].map((m) => [m[1], m[2]]));
}

describe.each(IOS_TARGETS)("iOS native strings in %s", (target) => {
    const lprojs = dirs(target).filter((d) => d.endsWith(".lproj"));
    const base = iosStrings(`${target}/en.lproj/Localizable.strings`);

    test("cover every language the app has", () => {
        expect(lprojs.map(iosLanguage).sort()).toEqual(appLanguages);
    });

    test("every .lproj is in the Xcode project for this target", () => {
        expect(projectLprojs(target)).toEqual(lprojs.map((l) => `${l}/Localizable.strings`).sort());
    });

    test("every literal the target's Swift looks up is an English key", () => {
        const keys = lookedUp(target);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
            expect(base.has(key), key).toBe(true);
        }
    });

    test.each(lprojs)("%s has every key, with the same placeholders", (lproj) => {
        const locale = iosStrings(`${target}/${lproj}/Localizable.strings`);
        expect([...locale.keys()].sort()).toEqual([...base.keys()].sort());
        for (const [key, english] of base) {
            expect(placeholders(locale.get(key)!), `${lproj} ${key}`).toEqual(
                placeholders(english),
            );
        }
    });
});
