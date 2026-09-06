// Characterisation tests for `getDecimalSeparator`, which is called (via
// `formatTokens`) for every token amount rendered, often inside `{#each}`
// blocks. Pins the CURRENT result per locale so the memoisation can be
// verified not to change anything.
import { afterEach, describe, expect, test, vi } from "vitest";
import { getDecimalSeparator } from "./i18n";

describe("getDecimalSeparator", () => {
    test("falls back to '.' when no locale is given", () => {
        expect(getDecimalSeparator(null)).toBe(".");
        expect(getDecimalSeparator(undefined)).toBe(".");
        expect(getDecimalSeparator("")).toBe(".");
    });

    test("per locale", () => {
        expect(getDecimalSeparator("en")).toBe(".");
        expect(getDecimalSeparator("en-GB")).toBe(".");
        expect(getDecimalSeparator("en-US")).toBe(".");
        expect(getDecimalSeparator("fr")).toBe(",");
        expect(getDecimalSeparator("fr-FR")).toBe(",");
        expect(getDecimalSeparator("de")).toBe(",");
        expect(getDecimalSeparator("de-DE")).toBe(",");
        expect(getDecimalSeparator("it")).toBe(",");
        expect(getDecimalSeparator("es")).toBe(",");
        expect(getDecimalSeparator("ja")).toBe(".");
        expect(getDecimalSeparator("zh-CN")).toBe(".");
        expect(getDecimalSeparator("ru")).toBe(",");
    });

    test("repeated and interleaved calls return identical strings", () => {
        for (let i = 0; i < 3; i++) {
            expect(getDecimalSeparator("en")).toBe(".");
            expect(getDecimalSeparator("fr")).toBe(",");
            expect(getDecimalSeparator("en")).toBe(".");
            expect(getDecimalSeparator("de")).toBe(",");
            expect(getDecimalSeparator(null)).toBe(".");
        }
    });

    describe("memoisation", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        test("Intl.NumberFormat is built at most once per locale", () => {
            // locales not used above, so the cache is cold for them
            getDecimalSeparator("en-AU");
            const spy = vi.spyOn(Intl, "NumberFormat");
            for (let i = 0; i < 5; i++) {
                expect(getDecimalSeparator("en-AU")).toBe(".");
            }
            expect(spy).toHaveBeenCalledTimes(0);
            expect(getDecimalSeparator("fr-CA")).toBe(",");
            expect(getDecimalSeparator("fr-CA")).toBe(",");
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });
});
