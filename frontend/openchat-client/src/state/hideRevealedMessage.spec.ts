import DRange from "drange";
import { MessageMap, type EventWrapper, type Message } from "@shared";
import { afterEach, describe, expect, test } from "vitest";
import { mergeEventsAndLocalUpdates } from "../utils/chat";
import { OpenChat } from "../openchat";
import { revealedDeletionsStore } from "../stores/revealedDeletions";
import { localUpdates } from "./localUpdates";
import { messageLocalUpdates } from "./message/localUpdates";

// A deleted message revealed (the new UIs' Reveal), then hidden again (their Hide), as the
// conversation merges the server's event with what's been done locally.

const deleted = { kind: "deleted_content", deletedBy: "mod", timestamp: 1_000n } as const;

function serverEvent(content: Message["content"]): EventWrapper<Message> {
    return {
        index: 1,
        timestamp: 1n,
        event: {
            kind: "message",
            messageId: 7n,
            messageIndex: 0,
            sender: "alice",
            content,
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: true,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

function shown(evt: EventWrapper<Message>): Message {
    const [merged] = mergeEventsAndLocalUpdates(
        [evt],
        [],
        new DRange(),
        new MessageMap(),
        new Set(),
        messageLocalUpdates.value,
        new MessageMap(),
        [],
    );
    return merged.event as Message;
}

afterEach(() => {
    messageLocalUpdates.set(new MessageMap());
    revealedDeletionsStore.clear();
});

describe("hiding a revealed deleted message", () => {
    test("shows its placeholder again, by who deleted it and when", () => {
        const evt = serverEvent(deleted);
        localUpdates.markMessageContentRevealed(7n, { kind: "text_content", text: "hi" });
        expect(shown(evt)).toMatchObject({ deleted: true, content: { kind: "text_content" } });

        localUpdates.markMessageContentHidden(7n, { deletedBy: "mod", timestamp: 1_000n });
        expect(shown(evt)).toMatchObject({ deleted: true, content: deleted });
    });

    test("can be revealed again after", () => {
        const evt = serverEvent(deleted);
        localUpdates.markMessageContentRevealed(7n, { kind: "text_content", text: "hi" });
        localUpdates.markMessageContentHidden(7n, { deletedBy: "mod", timestamp: 1_000n });
        localUpdates.markMessageContentRevealed(7n, { kind: "text_content", text: "hi" });
        expect(shown(evt)).toMatchObject({ deleted: true, content: { kind: "text_content" } });
    });

    test("without who deleted it, drops the revealed content alone", () => {
        const evt = serverEvent(deleted);
        localUpdates.markMessageContentRevealed(7n, { kind: "text_content", text: "hi" });
        localUpdates.markMessageContentHidden(7n, undefined);
        expect(shown(evt).content).toEqual(deleted);
    });

    test("the client's Hide uses who deleted it and when as kept at the reveal, and forgets them", () => {
        const evt = serverEvent({ kind: "text_content", text: "hi" });
        // revealed before the server's copy says it's deleted: kept by peekDeletedMessage
        revealedDeletionsStore.insert(7n, { deletedBy: "me", timestamp: 2_000n });
        localUpdates.markMessageContentRevealed(7n, { kind: "text_content", text: "hi" });
        OpenChat.prototype.hideRevealedMessage.call(undefined, 7n);
        expect(shown(evt)).toMatchObject({
            deleted: true,
            content: { kind: "deleted_content", deletedBy: "me", timestamp: 2_000n },
        });
        expect(revealedDeletionsStore.has(7n)).toBe(false);
    });
});
