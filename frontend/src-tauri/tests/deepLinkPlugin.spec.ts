import { readFileSync } from "node:fs";
import { join } from "node:path";

// tauri-plugin-deep-link's build script writes platform files from its `mobile` config.
// On Android it generates the manifest's intent filter for its app links. On a clean iOS
// build it rewrites gen/apple/<app>_iOS/<app>_iOS.entitlements and <app>_iOS/Info.plist: it
// sets the associated domains to the config's app links only, which would drop
// webcredentials:oc.app (native passkeys), and writes CFBundleURLTypes from the entries
// that aren't app links, removing them when there are none.

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

type AssociatedDomain = { scheme?: string[]; host?: string; appLink?: boolean };

// Mirrors the plugin's AssociatedDomain: `scheme` defaults to https + http, and an entry is
// an app link when it's a web link with a host unless `appLink` says otherwise
const schemes = (d: AssociatedDomain) => d.scheme ?? ["https", "http"];
const isWebLink = (d: AssociatedDomain) => schemes(d).some((s) => s === "https" || s === "http");
const isAppLink = (d: AssociatedDomain) => d.appLink ?? (isWebLink(d) && d.host !== undefined);

const conf = JSON.parse(read("tauri.conf.json"));
const iosConf = JSON.parse(read("tauri.ios.conf.json"));

describe("deep-link plugin config", () => {
    test("signs iOS with entitlements the plugin doesn't rewrite, allowing passkeys for oc.app", () => {
        const pbxproj = read("gen/apple/open-chat.xcodeproj/project.pbxproj");
        const paths = [...pbxproj.matchAll(/CODE_SIGN_ENTITLEMENTS = "?([^";]+)"?;/g)].map(
            (m) => m[1],
        );
        expect(paths.length).toBeGreaterThan(0);
        for (const path of paths) {
            expect(path).not.toBe("open-chat_iOS/open-chat_iOS.entitlements");
            expect(read(`gen/apple/${path}`)).toMatch(
                /<string>webcredentials:oc\.app(\?mode=developer)?<\/string>/,
            );
        }
    });

    test("registers the openchat scheme on iOS", () => {
        // tauri.ios.conf.json is merged over tauri.conf.json for iOS; arrays are replaced
        const mobile: AssociatedDomain[] =
            iosConf.plugins?.["deep-link"]?.mobile ?? conf.plugins["deep-link"].mobile;
        expect(mobile.some((d) => !isAppLink(d) && schemes(d).includes("openchat"))).toBe(true);
    });

    test("keeps oc.app https links as Android app links", () => {
        const mobile: AssociatedDomain[] = conf.plugins["deep-link"].mobile;
        expect(
            mobile.some((d) => isAppLink(d) && d.host === "oc.app" && schemes(d).includes("https")),
        ).toBe(true);
    });
});
