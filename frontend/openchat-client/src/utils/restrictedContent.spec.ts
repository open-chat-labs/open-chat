import { afterEach, describe, expect, test, vi } from "vitest";

async function load(appStore: boolean) {
    vi.resetModules();
    vi.stubEnv("OC_APP_STORE", appStore ? "true" : "false");
    return await import("./restrictedContent");
}

// Bits mirror MODERATION_CATEGORY_NAMES
const sexual = 1;
const sexualMinors = 2;
const violence = 4;
const violenceGraphic = 8;
const harassment = 16;
const harassmentThreatening = 32;
const selfHarm = 64;
const illicit = 128;

describe("messageFlagsRestricted", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("never restricts outside the app store build", async () => {
        const { messageFlagsRestricted } = await load(false);
        expect(messageFlagsRestricted(sexual | sexualMinors | violenceGraphic)).toBe(false);
    });

    test("hides severe categories in the app store build", async () => {
        const { messageFlagsRestricted } = await load(true);
        for (const flag of [
            sexual,
            sexualMinors,
            violenceGraphic,
            harassmentThreatening,
            selfHarm,
        ]) {
            expect(messageFlagsRestricted(flag)).toBe(true);
        }
    });

    test("shows messages flagged only for mild categories in the app store build", async () => {
        const { messageFlagsRestricted } = await load(true);
        expect(messageFlagsRestricted(harassment)).toBe(false);
        expect(messageFlagsRestricted(violence)).toBe(false);
        expect(messageFlagsRestricted(illicit)).toBe(false);
        expect(messageFlagsRestricted(harassment | violence | illicit)).toBe(false);
        expect(messageFlagsRestricted(harassment | selfHarm)).toBe(true);
        expect(messageFlagsRestricted(undefined)).toBe(false);
    });
});
