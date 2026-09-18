import { readFileSync } from "node:fs";
import { join } from "node:path";

// #9426. Android Auto Backup copies the app's files while the app is still running, so a
// restored WebView IndexedDB can be torn: a LevelDB log pointing at a blob file the backup
// doesn't contain. Nothing on disk needs to survive a reinstall, so nothing is backed up.

const main = (p: string) => readFileSync(join(__dirname, "../gen/android/app/src/main", p), "utf8");

const ANDROID_NS = "http://schemas.android.com/apk/res/android";

// Every domain the backup rules accept. `root` alone covers the data directory, but listing
// each one keeps the exclusion total if Android ever resolves the domains separately.
const DOMAINS = [
    "root",
    "file",
    "database",
    "sharedpref",
    "external",
    "device_root",
    "device_file",
    "device_database",
    "device_sharedpref",
];

function parse(xml: string): Document {
    return new DOMParser().parseFromString(xml, "application/xml");
}

function application(): Element {
    const app = parse(main("AndroidManifest.xml")).getElementsByTagName("application")[0];
    if (app === undefined) throw new Error("no <application> in AndroidManifest.xml");
    return app;
}

function rulesFile(attr: string): Document {
    const ref = application().getAttributeNS(ANDROID_NS, attr);
    expect(ref).toMatch(/^@xml\/\w+$/);
    return parse(main(`res/xml/${ref!.slice("@xml/".length)}.xml`));
}

// Every domain is excluded whole, and nothing is included back.
function expectExcludesEverything(section: Element) {
    expect(section.getElementsByTagName("include")).toHaveLength(0);
    const excluded = [...section.getElementsByTagName("exclude")]
        .filter((e) => e.getAttribute("path") === ".")
        .map((e) => e.getAttribute("domain"));
    expect(excluded.sort()).toEqual([...DOMAINS].sort());
}

function section(doc: Document, name: string): Element {
    const found = doc.getElementsByTagName(name);
    expect(found).toHaveLength(1);
    return found[0];
}

describe("Android backup (#9426)", () => {
    test("invariant 1: a cloud backup contains no files from the app's data directories", () => {
        expect(application().getAttributeNS(ANDROID_NS, "allowBackup")).toBe("false");
        expectExcludesEverything(section(rulesFile("dataExtractionRules"), "cloud-backup"));
    });

    test("invariant 2: a device-to-device transfer contains no files from the app's data directories", () => {
        expectExcludesEverything(section(rulesFile("dataExtractionRules"), "device-transfer"));
    });

    test("invariant 3: on Android 11 and below the app takes no part in backup or restore", () => {
        expect(application().getAttributeNS(ANDROID_NS, "allowBackup")).toBe("false");
        expectExcludesEverything(section(rulesFile("fullBackupContent"), "full-backup-content"));
    });

    test("invariant 5: the app declares no backupAgent, which could write data past the rules files", () => {
        expect(application().getAttributeNS(ANDROID_NS, "backupAgent")).toBeNull();
    });
});
