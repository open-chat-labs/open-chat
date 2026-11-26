import type { UserOrUserGroup, UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import { mentionedUsers, pickedMention } from "./composerEditor";
import { markdownToDoc, nodeToMarkdown } from "./markdownConversion";

const bobId = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const annId = "ryjl3-tyaaa-aaaaa-aaaba-cai";

function user(userId: string, username: string, displayName?: string): UserSummary {
    return { kind: "user", userId, username, displayName } as UserSummary;
}

describe("mentionedUsers (#10576 invariant 2)", () => {
    const users = new Map([
        [bobId, user(bobId, "bob", "Bob")],
        [annId, user(annId, "ann")],
    ]);

    test("the users the text mentions by id, each once, as the store has them", () => {
        expect(
            mentionedUsers(`@UserId(${bobId}) and @UserId(${annId}) and @UserId(${bobId})`, users),
        ).toEqual([
            { userId: bobId, username: "bob", displayName: "Bob" },
            { userId: annId, username: "ann", displayName: undefined },
        ]);
    });

    test("one the store doesn't hold goes as unknown, as the old editor's do", () => {
        const other = "qoctq-giaaa-aaaaa-aaaea-cai";
        expect(mentionedUsers(`hi @UserId(${other})`, users)).toEqual([
            { userId: other, username: "unknown", displayName: undefined },
        ]);
    });

    test("not a mention typed as @username, nor an id that isn't one", () => {
        expect(mentionedUsers("hi @bob and @UserId(42)", users)).toEqual([]);
    });

    test("the mention the editor writes for one picked is found again", () => {
        // the editor's document for "hi @Bob" with Bob picked, written as markdown by the one
        // conversion the old trees use
        const doc = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "hi " },
                        { type: "user_mention", attrs: { userId: bobId, username: "bob" } },
                    ],
                },
            ],
        };
        const markdown = nodeToMarkdown(doc);
        expect(markdown).toBe(`hi @UserId(${bobId})`);
        expect(mentionedUsers(markdown, users).map((u) => u.userId)).toEqual([bobId]);
        // and a draft of it comes back as the mention
        expect(nodeToMarkdown(markdownToDoc(markdown))).toBe(markdown);
    });
});

describe("pickedMention", () => {
    const bob = user(bobId, "bob") as UserOrUserGroup;
    const everyone = { kind: "everyone" } as UserOrUserGroup;
    const group = { kind: "user_group", id: 7, name: "devs", memberCount: 2 } as UserOrUserGroup;

    test("the candidate the composer's mention was made from", () => {
        const candidates = [everyone, bob, group];
        expect(pickedMention(candidates, { key: bobId })).toBe(bob);
        expect(pickedMention(candidates, { key: "everyone" })).toBe(everyone);
        expect(pickedMention(candidates, { key: "7" })).toBe(group);
    });

    test("none once the list has moved on", () => {
        expect(pickedMention([everyone], { key: bobId })).toBeUndefined();
    });
});
