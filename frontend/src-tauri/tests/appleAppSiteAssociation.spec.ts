import { readFileSync } from "node:fs";
import { join } from "node:path";

// iOS creates and uses passkeys for oc.app only for apps that oc.app's
// apple-app-site-association lists as <team>.<bundle id>. If the iOS project signs with a
// team or bundle id the file doesn't list, passkey sign-in fails on the device.

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

function settings(pbxproj: string, key: string): string[] {
    return [...pbxproj.matchAll(new RegExp(`^\\s*${key} = "?([^";]+)"?;`, "gm"))].map((m) => m[1]);
}

const aasaApps = (): string[] =>
    JSON.parse(read("../app/apple-app-site-association")).webcredentials.apps;

describe("apple-app-site-association", () => {
    test("lists the app id of every iOS build configuration", () => {
        const pbxproj = read("gen/apple/open-chat.xcodeproj/project.pbxproj");
        const teams = settings(pbxproj, "DEVELOPMENT_TEAM");
        const bundleIds = settings(pbxproj, "PRODUCT_BUNDLE_IDENTIFIER");
        expect(teams.length).toBeGreaterThan(0);
        expect(teams.length).toBe(bundleIds.length);

        for (let i = 0; i < teams.length; i++) {
            expect(aasaApps()).toContain(`${teams[i]}.${bundleIds[i]}`);
        }
    });

    // The tauri CLI signs with the team and identifier from its own config
    test("lists the app id the tauri config signs iOS builds as", () => {
        const conf = JSON.parse(read("tauri.conf.json"));
        const iosConf = JSON.parse(read("tauri.ios.conf.json"));
        const identifier = iosConf.identifier ?? conf.identifier;
        expect(aasaApps()).toContain(`${conf.bundle.iOS.developmentTeam}.${identifier}`);
    });
});
