import { OPENCHAT_BOT_USER_ID, type ChatSummary } from "@client";
import { describe, expect, test } from "vitest";
import { chatMenuActions } from "./chatMenu";

function dm(userId: string): ChatSummary {
    return { kind: "direct_chat", id: { kind: "direct_chat", userId } } as ChatSummary;
}

const person = { canLeave: false, blocked: false, isBot: false };

describe("chatMenuActions", () => {
    // 4b invariant 4: the OpenChat bot's DM is never offered for deletion
    test("never offers to delete the OpenChat bot's DM", () => {
        expect(chatMenuActions(dm(OPENCHAT_BOT_USER_ID), { ...person, isBot: true })).not.toContain(
            "delete",
        );
    });

    test("offers to delete any other DM, and to block or unblock a person", () => {
        expect(chatMenuActions(dm("them"), person)).toEqual(["block", "delete"]);
        expect(chatMenuActions(dm("them"), { ...person, blocked: true })).toEqual([
            "unblock",
            "delete",
        ]);
    });
});
