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
