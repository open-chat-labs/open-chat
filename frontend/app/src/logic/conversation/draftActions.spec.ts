import type { EnhancedReplyContext, EventWrapper, Message, MessageContext } from "@client";
import { composingMessageIndex, submitEdit } from "./draftActions";

const here: MessageContext = { chatId: { kind: "group_chat", groupId: "g1" } };
const elsewhere: MessageContext = { chatId: { kind: "group_chat", groupId: "g2" } };

const edited = {
    event: { messageIndex: 7, messageId: 70n },
} as EventWrapper<Message>;

function reply(sourceContext: MessageContext): EnhancedReplyContext {
    return { sourceContext, messageIndex: 3 } as EnhancedReplyContext;
}

describe("the message the composer is replying to or editing", () => {
    test("is the edited message", () => {
        expect(composingMessageIndex({ editingEvent: edited }, here)).toBe(7);
    });

    test("is the one replied to when it's in this chat, not one quoted from another", () => {
        expect(composingMessageIndex({ replyingTo: reply(here) }, here)).toBe(3);
        expect(composingMessageIndex({ replyingTo: reply(elsewhere) }, here)).toBeUndefined();
        expect(composingMessageIndex(undefined, here)).toBeUndefined();
    });
});

describe("saving an edit", () => {
    test("edits the draft's message with the text, its block markdown detected", async () => {
        const client = { editMessage: vi.fn(async () => true) };
        expect(await submitEdit(client, here, { editingEvent: edited }, "- a\n- b")).toBe(true);
        expect(client.editMessage).toHaveBeenCalledWith(here, "- a\n- b", true, edited);
    });

    test("says when it failed, and has nothing to fail with nothing being edited", async () => {
        const failing = { editMessage: vi.fn(async () => false) };
        expect(await submitEdit(failing, here, { editingEvent: edited }, "x")).toBe(false);
        expect(await submitEdit(failing, here, {}, "x")).toBe(true);
        expect(failing.editMessage).toHaveBeenCalledTimes(1);
    });
});
