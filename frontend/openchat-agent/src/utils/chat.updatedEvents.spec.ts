import type { DirectChatSummary } from "@shared";
import { describe, expect, test } from "vitest";
import { getUpdatedEvents } from "./chat";

function directChat(userId: string, latestEventIndex: number, lastUpdated: bigint) {
    return {
        id: { kind: "direct_chat", userId },
        kind: "direct_chat",
        latestEventIndex,
        lastUpdated,
    } as DirectChatSummary;
}

describe("getUpdatedEvents", () => {
    // #10670: the client can hold a new direct chat's events before an answer first reports the
    // chat (its own first message, loaded once sent), and a change to them in the same window, such
    // as a reaction, is folded into the chat's summary rather than listed
    test("a direct chat first reported in an updates answer lists all of its events as updated", () => {
        const chat = directChat("dm", 1, 5n);

        const updated = getUpdatedEvents([], [], [], [chat]);

        expect(updated.get(chat.id)).toEqual([
            { eventIndex: 0, timestamp: 5n },
            { eventIndex: 1, timestamp: 5n },
        ]);
    });
});
