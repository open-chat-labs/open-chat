import { readFileSync } from "node:fs";
import { join } from "node:path";

// On a clean build, tauri-plugin-deep-link's build script rewrites
// gen/apple/<app>_iOS/<app>_iOS.entitlements and <app>_iOS/Info.plist from the deep-link
// config. It sets the associated domains to the config's app links only, which drops
// webcredentials:oc.app (native passkeys), and it writes CFBundleURLTypes from the config's
// custom schemes, removing them when there are none.

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

type AssociatedDomain = { scheme?: string[] };

describe("iOS with the deep-link plugin", () => {
    test("signs with entitlements the plugin doesn't rewrite, allowing passkeys for oc.app", () => {
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

    test("registers the openchat scheme", () => {
        // tauri.ios.conf.json is merged over tauri.conf.json for iOS; arrays are replaced
        const conf = JSON.parse(read("tauri.conf.json"));
        const iosConf = JSON.parse(read("tauri.ios.conf.json"));
        const mobile: AssociatedDomain[] =
            iosConf.plugins?.["deep-link"]?.mobile ?? conf.plugins["deep-link"].mobile;
        expect(mobile.some((d) => d.scheme?.includes("openchat"))).toBe(true);
    });
});
