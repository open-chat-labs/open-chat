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

// One table per target that shows text: the app (CallRinger, the call screen), the Notification
// Service Extension (PushCore's renderer) and the share extension
const IOS_TARGETS = [
    "src-tauri/gen/apple/open-chat_iOS",
    "src-tauri/gen/apple/NotificationService",
    "src-tauri/gen/apple/ShareExtension",
];
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
