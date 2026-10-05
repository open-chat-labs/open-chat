import {
    MessageContextMap,
    type DirectChatIdentifier,
    type EventWrapper,
    type Message,
} from "@shared";
import { describe, expect, test } from "vitest";
import { localUpdates } from "./localUpdates";

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });

const message = (messageId: bigint, text: string) =>
    ({
        index: 0,
        timestamp: 0n,
        event: { kind: "message", messageId, content: { kind: "text_content", text } },
    }) as unknown as EventWrapper<Message>;

const texts = (messages: EventWrapper<Message>[]) =>
    messages.map((m) => (m.event.content.kind === "text_content" ? m.event.content.text : ""));

describe("moving a direct chat's failed messages onto the other user's new id", () => {
    test("moves them, keeping one already held under the new id", () => {
        const failed = new MessageContextMap<Map<bigint, EventWrapper<Message>>>();
        failed.set(
            { chatId: direct("old") },
            new Map([
                [1n, message(1n, "only under the old id")],
                [2n, message(2n, "older")],
            ]),
        );
        failed.set({ chatId: direct("new") }, new Map([[2n, message(2n, "newer")]]));
        localUpdates.initialiseFailedMessages(failed);

        localUpdates.moveFailedMessages(direct("old"), direct("new"));

        expect(localUpdates.anyFailed({ chatId: direct("old") })).toBe(false);
        expect(
            texts(localUpdates.failedMessagesForContext({ chatId: direct("new") })).sort(),
        ).toEqual(["newer", "only under the old id"]);
    });
});
