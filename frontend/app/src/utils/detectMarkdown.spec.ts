import { detectMarkdown } from "./detectMarkdown";

describe("detectMarkdown", () => {
    test("empty / nullish input is not markdown", () => {
        expect(detectMarkdown(null)).toBe(false);
        expect(detectMarkdown(undefined)).toBe(false);
        expect(detectMarkdown("")).toBe(false);
    });

    test("plain text is not markdown", () => {
        expect(detectMarkdown("hello world")).toBe(false);
        expect(detectMarkdown("#hashtag with no space")).toBe(false);
        expect(detectMarkdown("1.5 litres")).toBe(false);
        expect(detectMarkdown("a | b")).toBe(false);
        expect(detectMarkdown("inline `code` and **bold**")).toBe(false);
    });

    test("detects block level elements, including on later lines", () => {
        expect(detectMarkdown("# Heading")).toBe(true);
        expect(detectMarkdown("text\n## Heading")).toBe(true);
        expect(detectMarkdown("| a | b |")).toBe(true);
        expect(detectMarkdown("- item")).toBe(true);
        expect(detectMarkdown("  * item")).toBe(true);
        expect(detectMarkdown("1. item")).toBe(true);
        expect(detectMarkdown("> quote")).toBe(true);
        expect(detectMarkdown("```\ncode\n```")).toBe(true);
        expect(detectMarkdown("```\nunterminated")).toBe(false);
    });

    test("is stateless across repeated calls (no lastIndex leakage)", () => {
        for (let i = 0; i < 3; i++) {
            expect(detectMarkdown("- item")).toBe(true);
            expect(detectMarkdown("plain")).toBe(false);
        }
    });
});
