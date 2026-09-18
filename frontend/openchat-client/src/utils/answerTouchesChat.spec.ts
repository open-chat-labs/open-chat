import type { ChatIdentifier, ChatSummary } from "@shared";
import { describe, expect, test } from "vitest";
import { answerTouchesChat } from "./answerTouchesChat";

const direct = (userId: string): ChatIdentifier => ({ kind: "direct_chat", userId });
const group = (groupId: string): ChatIdentifier => ({ kind: "group_chat", groupId });
const channel = (communityId: string, channelId: number): ChatIdentifier => ({
    kind: "channel",
    communityId,
    channelId,
});
const summary = (id: ChatIdentifier) => ({ id }) as ChatSummary;

describe("answerTouchesChat", () => {
    test("a chat whose summary came back was touched", () => {
        expect(
            answerTouchesChat(group("g1"), [summary(direct("u1")), summary(group("g1"))], 0),
        ).toBe(true);
        expect(answerTouchesChat(channel("c1", 2), [summary(channel("c1", 2))], 0)).toBe(true);
    });

    test("a chat with updated events was touched even if its summary did not come back", () => {
        expect(answerTouchesChat(group("g1"), [], 1)).toBe(true);
    });

    test("an answer about other chats, or only global state, did not touch it", () => {
        expect(answerTouchesChat(group("g1"), [], 0)).toBe(false);
        expect(
            answerTouchesChat(group("g1"), [summary(group("g2")), summary(direct("g1"))], 0),
        ).toBe(false);
        expect(answerTouchesChat(channel("c1", 2), [summary(channel("c1", 3))], 0)).toBe(false);
    });
});
