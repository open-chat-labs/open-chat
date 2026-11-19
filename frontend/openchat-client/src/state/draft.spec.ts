import type { EnhancedReplyContext, EventWrapper, Message } from "@shared";
import { createDraftMessagesStore } from "./draft";

const context = { chatId: { kind: "group_chat" as const, groupId: "g" } };

function message(messageId: bigint, text: string): EventWrapper<Message> {
    return {
        index: 1,
        timestamp: 0n,
        event: {
            kind: "message",
            messageId,
            messageIndex: 1,
            sender: "me",
            content: { kind: "text_content", text },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

const replyingTo: EnhancedReplyContext = {
    kind: "rehydrated_reply_context",
    senderId: "them",
    eventIndex: 0,
    content: { kind: "text_content", text: "quoted" },
    messageId: 9n,
    messageIndex: 0,
    edited: false,
    isThreadRoot: false,
    sourceContext: context,
};

describe("a draft around an edit", () => {
    test("goes back to what was being written once the edit ends", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent(context, "hello");
        drafts.setReplyingTo(context, replyingTo);

        drafts.setEditing(context, message(1n, "old text"), new Map());
        expect(drafts.value.get(context)?.textContent).toBe("old text");

        drafts.endEditing(context);
        const after = drafts.value.get(context);
        expect(after?.textContent).toBe("hello");
        expect(after?.replyingTo).toEqual(replyingTo);
        expect(after?.editingEvent).toBeUndefined();
    });

    test("keeps what was written before the first edit when another edit starts", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent(context, "hello");
        drafts.setEditing(context, message(1n, "first"), new Map());
        drafts.setEditing(context, message(2n, "second"), new Map());

        drafts.endEditing(context);
        expect(drafts.value.get(context)?.textContent).toBe("hello");
    });

    test("is gone after an edit started with nothing written", () => {
        const drafts = createDraftMessagesStore();
        drafts.setEditing(context, message(1n, "old text"), new Map());

        drafts.endEditing(context);
        expect(drafts.value.get(context)).toBeUndefined();
    });
});

describe("replying to a message", () => {
    const other: EnhancedReplyContext = { ...replyingTo, messageId: 10n, messageIndex: 2 };

    test("while editing ends the edit, dropping its text for what was written before", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent(context, "hello");
        drafts.setEditing(context, message(1n, "old text"), new Map());
        drafts.setTextContent(context, "old text, changed");

        drafts.replyTo(context, other);
        const after = drafts.value.get(context);
        expect(after?.editingEvent).toBeUndefined();
        expect(after?.beforeEdit).toBeUndefined();
        expect(after?.textContent).toBe("hello");
        expect(after?.replyingTo).toEqual(other);
    });

    test("while editing replaces the reply there was before the edit", () => {
        const drafts = createDraftMessagesStore();
        drafts.setReplyingTo(context, replyingTo);
        drafts.setEditing(context, message(1n, "old text"), new Map());

        drafts.replyTo(context, other);
        const after = drafts.value.get(context);
        expect(after?.editingEvent).toBeUndefined();
        expect(after?.textContent).toBeUndefined();
        expect(after?.replyingTo).toEqual(other);
    });

    test("keeps what's being written when nothing is being edited", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent(context, "hello");
        drafts.replyTo(context, replyingTo);
        drafts.replyTo(context, other);

        const after = drafts.value.get(context);
        expect(after?.textContent).toBe("hello");
        expect(after?.replyingTo).toEqual(other);
    });

    test("then editing starts the edit, and cancelling it goes back to the reply", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent(context, "hello");
        drafts.replyTo(context, other);

        drafts.setEditing(context, message(1n, "old text"), new Map());
        const editing = drafts.value.get(context);
        expect(editing?.editingEvent?.event.messageId).toBe(1n);
        expect(editing?.textContent).toBe("old text");
        expect(editing?.replyingTo).toBeUndefined();

        drafts.endEditing(context);
        const after = drafts.value.get(context);
        expect(after?.textContent).toBe("hello");
        expect(after?.replyingTo).toEqual(other);
    });
});
