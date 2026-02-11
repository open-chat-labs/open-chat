import { describe, expect, test } from "vitest";
import { Version } from "./version";

describe("Version", () => {
    describe("parse", () => {
        test("parses valid version string", () => {
            const version = Version.parse("1.2.3");
            expect(version.toText()).toBe("1.2.3");
        });

        test("parses version with zeros", () => {
            const version = Version.parse("0.0.0");
            expect(version.toText()).toBe("0.0.0");
        });

        test("parses large version numbers", () => {
            const version = Version.parse("10.20.30");
            expect(version.toText()).toBe("10.20.30");
        });
    });

    describe("toText", () => {
        test("converts version to string", () => {
            const version = new Version(1, 2, 3);
            expect(version.toText()).toBe("1.2.3");
        });
    });

    describe("isGreaterThan with 'none' strategy", () => {
        test("always returns false regardless of version", () => {
            const v1 = new Version(2, 0, 0);
            const v2 = new Version(1, 0, 0);
            expect(v1.isGreaterThan(v2, "none")).toBe(false);
        });

        test("returns false even when versions are equal", () => {
            const v1 = new Version(1, 0, 0);
            const v2 = new Version(1, 0, 0);
            expect(v1.isGreaterThan(v2, "none")).toBe(false);
        });
    });

    describe("isGreaterThan with 'major' strategy", () => {
        test("returns true when major version is greater", () => {
            const v1 = new Version(2, 0, 0);
            const v2 = new Version(1, 0, 0);
            expect(v1.isGreaterThan(v2, "major")).toBe(true);
        });

        test("returns false when major version is equal", () => {
            const v1 = new Version(1, 5, 0);
            const v2 = new Version(1, 0, 0);
            expect(v1.isGreaterThan(v2, "major")).toBe(false);
        });

        test("returns false when major version is less", () => {
            const v1 = new Version(1, 0, 0);
            const v2 = new Version(2, 0, 0);
            expect(v1.isGreaterThan(v2, "major")).toBe(false);
        });

        test("ignores minor and patch differences", () => {
            const v1 = new Version(1, 99, 99);
            const v2 = new Version(1, 0, 0);
            expect(v1.isGreaterThan(v2, "major")).toBe(false);
        });
    });

    describe("isGreaterThan with 'minor' strategy", () => {
        test("returns true when major version is greater", () => {
            const v1 = new Version(2, 0, 0);
            const v2 = new Version(1, 5, 0);
            expect(v1.isGreaterThan(v2, "minor")).toBe(true);
        });

        test("returns false when major version is less", () => {
            const v1 = new Version(1, 5, 0);
            const v2 = new Version(2, 0, 0);
            expect(v1.isGreaterThan(v2, "minor")).toBe(false);
        });

        test("returns true when major is equal and minor is greater", () => {
            const v1 = new Version(1, 5, 0);
            const v2 = new Version(1, 4, 0);
            expect(v1.isGreaterThan(v2, "minor")).toBe(true);
        });

        test("returns false when major and minor are equal", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(1, 5, 0);
            expect(v1.isGreaterThan(v2, "minor")).toBe(false);
        });

        test("returns false when major is equal and minor is less", () => {
            const v1 = new Version(1, 4, 0);
            const v2 = new Version(1, 5, 0);
            expect(v1.isGreaterThan(v2, "minor")).toBe(false);
        });

        test("ignores patch differences", () => {
            const v1 = new Version(1, 5, 99);
            const v2 = new Version(1, 5, 0);
            expect(v1.isGreaterThan(v2, "minor")).toBe(false);
        });
    });

    describe("isGreaterThan with 'patch' strategy", () => {
        test("returns true when major version is greater", () => {
            const v1 = new Version(2, 0, 0);
            const v2 = new Version(1, 5, 10);
            expect(v1.isGreaterThan(v2, "patch")).toBe(true);
        });

        test("returns false when major version is less", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(2, 0, 0);
            expect(v1.isGreaterThan(v2, "patch")).toBe(false);
        });

        test("returns true when major is equal and minor is greater", () => {
            const v1 = new Version(1, 5, 0);
            const v2 = new Version(1, 4, 10);
            expect(v1.isGreaterThan(v2, "patch")).toBe(true);
        });

        test("returns false when major is equal and minor is less", () => {
            const v1 = new Version(1, 4, 10);
            const v2 = new Version(1, 5, 0);
            expect(v1.isGreaterThan(v2, "patch")).toBe(false);
        });

        test("returns true when major and minor are equal and patch is greater", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(1, 5, 9);
            expect(v1.isGreaterThan(v2, "patch")).toBe(true);
        });

        test("returns false when major, minor and patch are equal", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(1, 5, 10);
            expect(v1.isGreaterThan(v2, "patch")).toBe(false);
        });

        test("returns false when major and minor are equal and patch is less", () => {
            const v1 = new Version(1, 5, 9);
            const v2 = new Version(1, 5, 10);
            expect(v1.isGreaterThan(v2, "patch")).toBe(false);
        });
    });

    describe("isGreaterThan with default strategy", () => {
        test("defaults to 'patch' strategy", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(1, 5, 9);
            expect(v1.isGreaterThan(v2)).toBe(true);
        });
    });

    describe("real-world scenarios", () => {
        test("typical semver progression", () => {
            const versions = [
                Version.parse("1.0.0"),
                Version.parse("1.0.1"),
                Version.parse("1.1.0"),
                Version.parse("2.0.0"),
            ];

            expect(versions[1].isGreaterThan(versions[0], "patch")).toBe(true);
            expect(versions[2].isGreaterThan(versions[1], "minor")).toBe(true);
            expect(versions[3].isGreaterThan(versions[2], "major")).toBe(true);
        });

        test("OTA update scenarios", () => {
            const current = Version.parse("1.5.3");
            const patchUpdate = Version.parse("1.5.4");
            const minorUpdate = Version.parse("1.6.0");
            const majorUpdate = Version.parse("2.0.0");

            // With 'none' strategy, no updates trigger
            expect(majorUpdate.isGreaterThan(current, "none")).toBe(false);

            // With 'major' strategy, only major updates trigger
            expect(patchUpdate.isGreaterThan(current, "major")).toBe(false);
            expect(minorUpdate.isGreaterThan(current, "major")).toBe(false);
            expect(majorUpdate.isGreaterThan(current, "major")).toBe(true);

            // With 'minor' strategy, minor and major updates trigger
            expect(patchUpdate.isGreaterThan(current, "minor")).toBe(false);
            expect(minorUpdate.isGreaterThan(current, "minor")).toBe(true);
            expect(majorUpdate.isGreaterThan(current, "minor")).toBe(true);

            // With 'patch' strategy, all updates trigger
            expect(patchUpdate.isGreaterThan(current, "patch")).toBe(true);
            expect(minorUpdate.isGreaterThan(current, "patch")).toBe(true);
            expect(majorUpdate.isGreaterThan(current, "patch")).toBe(true);
        });
    });
});
