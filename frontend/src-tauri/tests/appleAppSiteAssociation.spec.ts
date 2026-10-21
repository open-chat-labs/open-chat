import { readFileSync } from "node:fs";
import { join } from "node:path";

// iOS creates and uses passkeys for oc.app only for apps that oc.app's
// apple-app-site-association lists as <team>.<bundle id>. If the iOS project signs with a
// team or bundle id the file doesn't list, passkey sign-in fails on the device.

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

function settings(pbxproj: string, key: string): string[] {
    return [...pbxproj.matchAll(new RegExp(`^\\s*${key} = "?([^";]+)"?;`, "gm"))].map((m) => m[1]);
}

describe("apple-app-site-association", () => {
    test("lists the app id of every iOS build configuration", () => {
        const pbxproj = read("gen/apple/open-chat.xcodeproj/project.pbxproj");
        const teams = settings(pbxproj, "DEVELOPMENT_TEAM");
        const bundleIds = settings(pbxproj, "PRODUCT_BUNDLE_IDENTIFIER");
        expect(teams.length).toBeGreaterThan(0);
        expect(teams.length).toBe(bundleIds.length);

        const aasa = JSON.parse(read("../app/apple-app-site-association"));
        for (let i = 0; i < teams.length; i++) {
            expect(aasa.webcredentials.apps).toContain(`${teams[i]}.${bundleIds[i]}`);
        }
    });
});
