import type { UserSummary } from "openchat-shared";
import { buildDisplayName } from "./user";
import { marked } from "marked";

const userLookup = new Map<string, UserSummary>();
userLookup.set("xyz", {
    kind: "user",
    userId: "xyz",
    username: "julian_jelfs",
    displayName: "ℙ𝕌𝕄ℙ𝕂𝕀ℕ🎃✅️",
    updated: 0n,
    suspended: false,
    diamondStatus: "active",
    chitBalance: 0,
    totalChitEarned: 0,
    streak: 0,
    isUniquePerson: true,
});

describe("buildUsername", () => {
    test("doesn't mangle names with funny characters", () => {
        const name = buildDisplayName(userLookup, "xyz", false, true);
        expect(name).toBe("**ℙ𝕌𝕄ℙ𝕂𝕀ℕ🎃✅️**");
    });

    describe("Markdown parsing with weird fonts", () => {
        test("with subsequent text", () => {
            const parsed = marked.parseInline("**ℙ𝕌𝕄ℙ𝕂𝕀ℕ** there");
            expect(parsed).toBe("<strong>ℙ𝕌𝕄ℙ𝕂𝕀ℕ</strong> there");
        });

        test("without subsequent text", () => {
            const parsed = marked.parseInline("**ℙ𝕌𝕄ℙ𝕂𝕀ℕ**");
            expect(parsed).toBe("<strong>ℙ𝕌𝕄ℙ𝕂𝕀ℕ</strong>");
        });
    });

    describe("Link rendering", () => {
        test("standard link processing", () => {
            const txt = "Are links [broken](https://www.google.com) or not?";
            expect(marked.parseInline(txt, { breaks: true })).toBe(
                'Are links <a href="https://www.google.com">broken</a> or not?',
            );
        });

        test("bold links", () => {
            const txt = "[**@broken**](https://www.google.com)";
            expect(marked.parseInline(txt, { breaks: true })).toBe(
                '<a href="https://www.google.com"><strong>@broken</strong></a>',
            );
        });
    });
});
