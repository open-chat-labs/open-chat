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
const summary = (id: ChatIdentifier, lastUpdated = 1n) => ({ id, lastUpdated }) as ChatSummary;

describe("answerTouchesChat", () => {
    test("a chat whose summary came back changed was touched", () => {
        expect(
            answerTouchesChat(
                group("g1"),
                summary(group("g1"), 1n),
                [summary(direct("u1")), summary(group("g1"), 2n)],
                0,
            ),
        ).toBe(true);
        expect(
            answerTouchesChat(
                channel("c1", 2),
                summary(channel("c1", 2), 1n),
                [summary(channel("c1", 2), 2n)],
                0,
            ),
        ).toBe(true);
    });

    test("a chat with no summary held before the fold was touched if its summary came back", () => {
        expect(answerTouchesChat(group("g1"), undefined, [summary(group("g1"))], 0)).toBe(true);
    });

    test("a summary that came back unchanged, as a channel does with its community, did not touch it", () => {
        expect(
            answerTouchesChat(
                channel("c1", 2),
                summary(channel("c1", 2)),
                [summary(channel("c1", 2)), summary(channel("c1", 3), 2n)],
                0,
            ),
        ).toBe(false);
    });

    test("a chat with updated events was touched even if its summary did not come back", () => {
        expect(answerTouchesChat(group("g1"), summary(group("g1")), [], 1)).toBe(true);
    });

    test("an answer about other chats, or only global state, did not touch it", () => {
        const held = summary(group("g1"));
        expect(answerTouchesChat(group("g1"), held, [], 0)).toBe(false);
        expect(
            answerTouchesChat(
                group("g1"),
                held,
                [summary(group("g2"), 2n), summary(direct("g1"), 2n)],
                0,
            ),
        ).toBe(false);
        expect(
            answerTouchesChat(
                channel("c1", 2),
                summary(channel("c1", 2)),
                [summary(channel("c1", 3), 2n)],
                0,
            ),
        ).toBe(false);
    });
});
