import { OPENCHAT_BOT_USER_ID, ROLE_MEMBER, ROLE_NONE, type ChatSummary } from "@client";
import { describe, expect, test } from "vitest";
import { chatMenuActions } from "./chatMenu";

function dm(userId: string): ChatSummary {
    return { kind: "direct_chat", id: { kind: "direct_chat", userId } } as ChatSummary;
}

const person = { canLeave: false, blocked: false, isBot: false };

describe("chatMenuActions", () => {
    // 4b invariant 4: the OpenChat bot's DM is never offered for deletion, whether or not the
    // caller says it's a bot (the chat-list row doesn't)
    test("never offers to delete the OpenChat bot's DM", () => {
        for (const isBot of [true, false]) {
            expect(chatMenuActions(dm(OPENCHAT_BOT_USER_ID), { ...person, isBot })).not.toContain(
                "delete",
            );
        }
    });

    test("offers to delete any other DM, and to block or unblock a person", () => {
        expect(chatMenuActions(dm("them"), person)).toEqual(["block", "delete"]);
        expect(chatMenuActions(dm("them"), { ...person, blocked: true })).toEqual([
            "unblock",
            "delete",
        ]);
    });

    test("offers to leave a group only to a member", () => {
        const group = (role: number) =>
            ({
                kind: "group_chat",
                id: { kind: "group_chat", groupId: "g" },
                membership: { role },
            }) as ChatSummary;
        expect(chatMenuActions(group(ROLE_MEMBER), { ...person, canLeave: true })).toEqual([
            "leave",
        ]);
        expect(chatMenuActions(group(ROLE_NONE), { ...person, canLeave: true })).toEqual([]);
    });
});
