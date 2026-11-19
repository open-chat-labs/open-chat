import type { UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import { typedMentions } from "./typedMentions";

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

    test("leaves a text without mentions, and @everyone, alone", () => {
        expect(typed("hello @everyone")).toBe("hello @everyone");
    });
});
