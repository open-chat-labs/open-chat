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

    describe("isGreaterThan", () => {
        test("returns true when major version is greater", () => {
            const v1 = new Version(2, 0, 0);
            const v2 = new Version(1, 5, 10);
            expect(v1.isGreaterThan(v2)).toBe(true);
        });

        test("returns false when major version is less", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(2, 0, 0);
            expect(v1.isGreaterThan(v2)).toBe(false);
        });

        test("returns true when major is equal and minor is greater", () => {
            const v1 = new Version(1, 5, 0);
            const v2 = new Version(1, 4, 10);
            expect(v1.isGreaterThan(v2)).toBe(true);
        });

        test("returns false when major is equal and minor is less", () => {
            const v1 = new Version(1, 4, 10);
            const v2 = new Version(1, 5, 0);
            expect(v1.isGreaterThan(v2)).toBe(false);
        });

        test("returns true when major and minor are equal and patch is greater", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(1, 5, 9);
            expect(v1.isGreaterThan(v2)).toBe(true);
        });

        test("returns false when major, minor and patch are equal", () => {
            const v1 = new Version(1, 5, 10);
            const v2 = new Version(1, 5, 10);
            expect(v1.isGreaterThan(v2)).toBe(false);
        });

        test("returns false when major and minor are equal and patch is less", () => {
            const v1 = new Version(1, 5, 9);
            const v2 = new Version(1, 5, 10);
            expect(v1.isGreaterThan(v2)).toBe(false);
        });
    });

    describe("canUpdateTo with 'none' strategy", () => {
        test("always returns false regardless of version", () => {
            const current = new Version(1, 0, 0);
            const newer = new Version(2, 0, 0);
            expect(current.canUpdateTo(newer, "none")).toBe(false);
        });

        test("returns false even for patch updates", () => {
            const current = new Version(1, 0, 0);
            const newer = new Version(1, 0, 1);
            expect(current.canUpdateTo(newer, "none")).toBe(false);
        });
    });

    describe("canUpdateTo with 'major' strategy", () => {
        test("allows major version updates", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(2, 0, 0);
            expect(current.canUpdateTo(newer, "major")).toBe(true);
        });

        test("allows minor version updates", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 6, 0);
            expect(current.canUpdateTo(newer, "major")).toBe(true);
        });

        test("allows patch version updates", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 5, 4);
            expect(current.canUpdateTo(newer, "major")).toBe(true);
        });

        test("returns false when new version is not greater", () => {
            const current = new Version(2, 0, 0);
            const older = new Version(1, 5, 3);
            expect(current.canUpdateTo(older, "major")).toBe(false);
        });

        test("returns false when versions are equal", () => {
            const current = new Version(1, 5, 3);
            const same = new Version(1, 5, 3);
            expect(current.canUpdateTo(same, "major")).toBe(false);
        });
    });

    describe("canUpdateTo with 'minor' strategy", () => {
        test("disallows major version updates", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(2, 0, 0);
            expect(current.canUpdateTo(newer, "minor")).toBe(false);
        });

        test("allows minor version updates within same major", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 6, 0);
            expect(current.canUpdateTo(newer, "minor")).toBe(true);
        });

        test("allows patch version updates within same major", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 5, 4);
            expect(current.canUpdateTo(newer, "minor")).toBe(true);
        });

        test("allows multiple minor increments", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 8, 0);
            expect(current.canUpdateTo(newer, "minor")).toBe(true);
        });

        test("returns false when new version is not greater", () => {
            const current = new Version(1, 6, 0);
            const older = new Version(1, 5, 3);
            expect(current.canUpdateTo(older, "minor")).toBe(false);
        });

        test("returns false when versions are equal", () => {
            const current = new Version(1, 5, 3);
            const same = new Version(1, 5, 3);
            expect(current.canUpdateTo(same, "minor")).toBe(false);
        });
    });

    describe("canUpdateTo with 'patch' strategy", () => {
        test("disallows major version updates", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(2, 0, 0);
            expect(current.canUpdateTo(newer, "patch")).toBe(false);
        });

        test("disallows minor version updates", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 6, 0);
            expect(current.canUpdateTo(newer, "patch")).toBe(false);
        });

        test("allows patch version updates within same major and minor", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 5, 4);
            expect(current.canUpdateTo(newer, "patch")).toBe(true);
        });

        test("allows multiple patch increments", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(1, 5, 10);
            expect(current.canUpdateTo(newer, "patch")).toBe(true);
        });

        test("returns false when new version is not greater", () => {
            const current = new Version(1, 5, 4);
            const older = new Version(1, 5, 3);
            expect(current.canUpdateTo(older, "patch")).toBe(false);
        });

        test("returns false when versions are equal", () => {
            const current = new Version(1, 5, 3);
            const same = new Version(1, 5, 3);
            expect(current.canUpdateTo(same, "patch")).toBe(false);
        });
    });

    describe("canUpdateTo with default strategy", () => {
        test("defaults to 'major' strategy", () => {
            const current = new Version(1, 5, 3);
            const newer = new Version(2, 0, 0);
            expect(current.canUpdateTo(newer)).toBe(true);
        });
    });

    describe("real-world OTA update scenarios", () => {
        const current = Version.parse("1.5.3");

        test("patch update: 1.5.3 -> 1.5.4", () => {
            const update = Version.parse("1.5.4");

            expect(current.canUpdateTo(update, "none")).toBe(false);
            expect(current.canUpdateTo(update, "patch")).toBe(true);
            expect(current.canUpdateTo(update, "minor")).toBe(true);
            expect(current.canUpdateTo(update, "major")).toBe(true);
        });

        test("minor update: 1.5.3 -> 1.6.0", () => {
            const update = Version.parse("1.6.0");

            expect(current.canUpdateTo(update, "none")).toBe(false);
            expect(current.canUpdateTo(update, "patch")).toBe(false);
            expect(current.canUpdateTo(update, "minor")).toBe(true);
            expect(current.canUpdateTo(update, "major")).toBe(true);
        });

        test("major update: 1.5.3 -> 2.0.0", () => {
            const update = Version.parse("2.0.0");

            expect(current.canUpdateTo(update, "none")).toBe(false);
            expect(current.canUpdateTo(update, "patch")).toBe(false);
            expect(current.canUpdateTo(update, "minor")).toBe(false);
            expect(current.canUpdateTo(update, "major")).toBe(true);
        });

        test("mixed update: 1.5.3 -> 1.6.2 (minor + patch)", () => {
            const update = Version.parse("1.6.2");

            expect(current.canUpdateTo(update, "none")).toBe(false);
            expect(current.canUpdateTo(update, "patch")).toBe(false);
            expect(current.canUpdateTo(update, "minor")).toBe(true);
            expect(current.canUpdateTo(update, "major")).toBe(true);
        });

        test("mixed update: 1.5.3 -> 2.1.5 (major + minor + patch)", () => {
            const update = Version.parse("2.1.5");

            expect(current.canUpdateTo(update, "none")).toBe(false);
            expect(current.canUpdateTo(update, "patch")).toBe(false);
            expect(current.canUpdateTo(update, "minor")).toBe(false);
            expect(current.canUpdateTo(update, "major")).toBe(true);
        });

        test("conservative patch-only updates", () => {
            const current = Version.parse("2.0.0");

            expect(current.canUpdateTo(Version.parse("2.0.1"), "patch")).toBe(true);
            expect(current.canUpdateTo(Version.parse("2.1.0"), "patch")).toBe(false);
            expect(current.canUpdateTo(Version.parse("3.0.0"), "patch")).toBe(false);
        });

        test("balanced minor updates", () => {
            const current = Version.parse("2.0.0");

            expect(current.canUpdateTo(Version.parse("2.0.1"), "minor")).toBe(true);
            expect(current.canUpdateTo(Version.parse("2.1.0"), "minor")).toBe(true);
            expect(current.canUpdateTo(Version.parse("2.5.3"), "minor")).toBe(true);
            expect(current.canUpdateTo(Version.parse("3.0.0"), "minor")).toBe(false);
        });
    });
});
