import { describe, expect, it } from "vitest";
import { markdownToDoc, nodeToMarkdown } from "./markdownConversion";

function roundtrip(markdown: string): string {
    return nodeToMarkdown(markdownToDoc(markdown));
}

describe("markdown roundtrip", () => {
    it("plain text", () => {
        expect(roundtrip("Hello world")).toBe("Hello world");
    });

    it("bold", () => {
        expect(roundtrip("**bold**")).toBe("**bold**");
    });

    it("italic", () => {
        expect(roundtrip("*italic*")).toBe("*italic*");
    });

    it("bold and italic", () => {
        expect(roundtrip("***bold italic***")).toBe("***bold italic***");
    });

    it("strikethrough", () => {
        expect(roundtrip("~~strike~~")).toBe("~~strike~~");
    });

    it("inline code", () => {
        expect(roundtrip("`code`")).toBe("`code`");
    });

    it("underline", () => {
        expect(roundtrip("<u>underline</u>")).toBe("<u>underline</u>");
    });

    it("link", () => {
        expect(roundtrip("[click here](https://example.com)")).toBe(
            "[click here](https://example.com)",
        );
    });

    it("mention", () => {
        expect(roundtrip("Hey @UserId(42) how are you")).toBe("Hey @UserId(42) how are you");
    });

    it("mixed inline", () => {
        expect(roundtrip("Hello **world** and *everyone* at @UserId(1)")).toBe(
            "Hello **world** and *everyone* at @UserId(1)",
        );
    });

    it("markdown link", () => {
        expect(roundtrip("[testing links](https://www.bbc.co.uk/news/articles/crlp991nw41o)")).toBe(
            "[testing links](https://www.bbc.co.uk/news/articles/crlp991nw41o)",
        );
    });

    it("markdown link with trailing text", () => {
        expect(
            roundtrip(
                "[what about this](https://www.bbc.co.uk/news/articles/crlp991nw41o) I hope this still works",
            ),
        ).toBe(
            "[what about this](https://www.bbc.co.uk/news/articles/crlp991nw41o) I hope this still works",
        );
    });

    it("markdown link with parentheses in URL", () => {
        expect(
            roundtrip(
                "[Wikipedia link](https://en.wikipedia.org/wiki/Foo_(bar)) and more text",
            ),
        ).toBe("[Wikipedia link](https://en.wikipedia.org/wiki/Foo_(bar)) and more text");
    });

    it("heading level 1", () => {
        expect(roundtrip("# Heading")).toBe("# Heading");
    });

    it("heading level 3", () => {
        expect(roundtrip("### Sub heading")).toBe("### Sub heading");
    });

    it("horizontal rule", () => {
        expect(roundtrip("---")).toBe("---");
    });

    it("bullet list", () => {
        expect(roundtrip("- one\n- two\n- three")).toBe("- one\n- two\n- three");
    });

    it("ordered list", () => {
        expect(roundtrip("1. first\n2. second\n3. third")).toBe("1. first\n2. second\n3. third");
    });

    it("blockquote", () => {
        expect(roundtrip("> quoted text")).toBe("> quoted text");
    });

    it("code block without language", () => {
        expect(roundtrip("```\nsome code\n```")).toBe("```\nsome code\n```");
    });

    it("code block with language", () => {
        expect(roundtrip("```rust\nfn main() {}\n```")).toBe("```rust\nfn main() {}\n```");
    });

    it("multiple paragraphs", () => {
        expect(roundtrip("First paragraph\n\nSecond paragraph")).toBe(
            "First paragraph\n\nSecond paragraph",
        );
    });

    it("hard break within paragraph", () => {
        expect(roundtrip("line one\nline two")).toBe("line one\nline two");
    });

    it("inline formatting in heading", () => {
        expect(roundtrip("# Hello **world**")).toBe("# Hello **world**");
    });

    it("inline formatting in list items", () => {
        expect(roundtrip("- **bold item**\n- *italic item*")).toBe(
            "- **bold item**\n- *italic item*",
        );
    });
});
