import type { ChatEvent, EventWrapper, Message } from "@client";
import { describe, expect, test } from "vitest";
import { deletionOf, revealedDeletion } from "./revealedDeletion";

function message(messageId: bigint, content: Message["content"]): EventWrapper<ChatEvent> {
    return {
        index: Number(messageId),
        timestamp: 1n,
        event: {
            kind: "message",
            messageId,
            messageIndex: Number(messageId),
            sender: "alice",
            content,
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: content.kind === "deleted_content",
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

describe("a revealed message's deletion", () => {
    const deleted = { kind: "deleted_content", deletedBy: "mod", timestamp: 9n } as const;
    const events = [
        message(1n, { kind: "text_content", text: "hi" }),
        message(2n, deleted),
        message(3n, { kind: "text_content", text: "later" }),
    ];

    test("is the server's deleted content for the message", () => {
        expect(deletionOf(events, 2n)).toEqual(deleted);
    });

    test("is none where the server's copy isn't deleted, or isn't loaded", () => {
        expect(deletionOf(events, 1n)).toBeUndefined();
        expect(deletionOf(events, 4n)).toBeUndefined();
        expect(deletionOf([], 2n)).toBeUndefined();
    });

    test("is what was kept as it was revealed, before the server's copy", () => {
        expect(revealedDeletion({ deletedBy: "me", timestamp: 3n }, events, 1n)).toEqual({
            kind: "deleted_content",
            deletedBy: "me",
            timestamp: 3n,
        });
        expect(revealedDeletion(undefined, events, 2n)).toEqual(deleted);
        expect(revealedDeletion(undefined, events, 1n)).toBeUndefined();
    });
});
