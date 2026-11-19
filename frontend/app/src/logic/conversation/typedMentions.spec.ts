import type { UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import { marked } from "marked";
import { markdownSegments, typedMentions } from "./typedMentions";

describe("typedMentions", () => {
    const users = new Map([
        ["a1", { userId: "a1", username: "alice" } as UserSummary],
        ["b2", { userId: "b2", username: "bob" } as UserSummary],
    ]);
    const userGroups = new Map([[7, { name: "mods" }]]);
    const typed = typedMentions({ users, userGroups });

    test("names each user and group mentioned as typed", () => {
        expect(typed("hi @UserId(a1) and @UserId(b2), @UserGroup(7)")).toBe(
            "hi @alice and @bob, @mods",
        );
    });

    test("leaves a mention whose user or group isn't known as it is", () => {
        expect(typed("hi @UserId(zz) and @UserGroup(8)")).toBe("hi @UserId(zz) and @UserGroup(8)");
    });

    test("escapes the names for a text going through Markdown, not the rest", () => {
        const odd = new Map([["j1", { userId: "j1", username: "_john_" } as UserSummary]]);
        const groups = new Map([[3, { name: "__mods__" }]]);
        const marked = typedMentions({ users: odd, userGroups: groups }, { markdown: true });
        expect(marked("**hi** @UserId(j1) @UserGroup(3) @UserId(zz)")).toBe(
            "**hi** @&#95;john&#95; @&#95;&#95;mods&#95;&#95; @UserId(zz)",
        );
    });

    test("leaves the names in a code span unescaped for Markdown, which shows them as they are", () => {
        const odd = new Map([["b1", { userId: "b1", username: "_bob_" } as UserSummary]]);
        const groups = new Map([[3, { name: "jo-ann" }]]);
        const md = typedMentions({ users: odd, userGroups: groups }, { markdown: true });
        expect(md("see `@UserId(b1)` and ``@UserGroup(3) ` x`` then @UserId(b1)")).toBe(
            "see `@_bob_` and ``@jo-ann ` x`` then @&#95;bob&#95;",
        );
        // as Markdown (marked) renders it: the name in the code span as typed
        expect(marked.parseInline(md("`@UserId(b1)` @UserId(b1)"))).toBe(
            "<code>@_bob_</code> @&#95;bob&#95;",
        );
    });

    test("leaves a text without mentions, and @everyone, alone", () => {
        expect(typed("hello @everyone")).toBe("hello @everyone");
    });
});

describe("markdownSegments", () => {
    const segments = (text: string) =>
        markdownSegments(text).map(({ code, text }) => (code ? `[${text}]` : text));

    test("splits out the code spans; joined, the segments are the text", () => {
        const text = "a `b` c ``d ` e`` f";
        expect(segments(text)).toEqual(["a ", "[`b`]", " c ", "[``d ` e``]", " f"]);
        expect(
            markdownSegments(text)
                .map((s) => s.text)
                .join(""),
        ).toBe(text);
    });

    test("a run with no closing run of the same length is text", () => {
        expect(segments("a ``b` c")).toEqual(["a ``b` c"]);
        expect(segments("`a`` b ``c`")).toEqual(["[`a`` b ``c`]"]);
    });

    test("a backslash before a run escapes its first backtick, two backslashes don't", () => {
        expect(segments("\\`a` b`")).toEqual(["\\`a", "[` b`]"]);
        expect(segments("\\\\`a`")).toEqual(["\\\\", "[`a`]"]);
        expect(segments("\\``a`")).toEqual(["\\`", "[`a`]"]);
    });

    test("a text without backticks is one segment, an empty text none", () => {
        expect(segments("plain")).toEqual(["plain"]);
        expect(segments("")).toEqual([]);
    });
});
