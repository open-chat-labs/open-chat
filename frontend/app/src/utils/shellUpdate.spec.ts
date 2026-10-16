import { Version } from "@client";
import { describe, expect, it } from "vitest";
import { releasePath, shellUpdateFrom, storeOfferReaches, versionFromCode } from "./shellUpdate";

function release(tag: string, nativeVersion?: string) {
    const marker = nativeVersion === undefined ? "" : `\n<!-- native-version: ${nativeVersion} -->`;
    return { tag_name: tag, body: `Release notes${marker}` };
}

describe("shellUpdateFrom", () => {
    it("announces a release whose native code is newer than the installed shell", () => {
        const update = shellUpdateFrom("2.0.2089", release("v2.0.2130-android", "2.0.2126"));
        expect(update?.toText()).toBe("2.0.2130");
    });

    it("stays silent when the release only changed the web bundle", () => {
        expect(
            shellUpdateFrom("2.0.2089", release("v2.0.2125-android", "2.0.2089")),
        ).toBeUndefined();
        expect(
            shellUpdateFrom("2.0.2100", release("v2.0.2125-android", "2.0.2089")),
        ).toBeUndefined();
    });

    it("stays silent when the release has no native-version marker", () => {
        expect(shellUpdateFrom("2.0.2089", release("v2.0.2125-android"))).toBeUndefined();
    });

    it("never announces a release that is not an android build", () => {
        expect(
            shellUpdateFrom("2.0.2089", release("v2.0.2125-website", "2.0.2125")),
        ).toBeUndefined();
    });

    it("stays silent when the shell version is unknown", () => {
        expect(
            shellUpdateFrom(undefined, release("v2.0.2125-android", "2.0.2125")),
        ).toBeUndefined();
    });
});

describe("versionFromCode", () => {
    it("inverts the gradle versionCode formula", () => {
        expect(versionFromCode(2_000_000 + 2125).toText()).toBe("2.0.2125");
        expect(versionFromCode(3 * 1_000_000 + 12 * 10_000 + 7).toText()).toBe("3.12.7");
    });
});

describe("releasePath", () => {
    it("never consults GitHub for a store build Play offers nothing to", () => {
        expect(releasePath(true, undefined)).toBeUndefined();
    });

    it("asks a store build about the release Play offers, not the latest on GitHub", () => {
        expect(releasePath(true, Version.parse("2.0.2125"))).toBe("tags/v2.0.2125-android");
    });

    it("asks a sideloaded build about the latest GitHub release", () => {
        expect(releasePath(false, undefined)).toBe("latest");
    });
});

describe("storeOfferReaches", () => {
    const target = Version.parse("2.1.5");

    it("is false when Play offers nothing", () => {
        expect(storeOfferReaches(undefined, target)).toBe(false);
    });

    it("is false when what Play offers is still on an older minor", () => {
        expect(storeOfferReaches(Version.parse("2.0.2130"), target)).toBe(false);
    });

    it("is true when what Play offers can patch its way to the target", () => {
        expect(storeOfferReaches(Version.parse("2.1.0"), target)).toBe(true);
        expect(storeOfferReaches(Version.parse("2.1.7"), target)).toBe(true);
    });
});
