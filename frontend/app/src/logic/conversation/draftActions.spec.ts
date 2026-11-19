import {
    localUpdates,
    type AttachmentContent,
    type EnhancedReplyContext,
    type EventWrapper,
    type GiphyContent,
    type Message,
    type MessageContext,
} from "@client";
import { attachGif, composingMessageIndex, submitEdit } from "./draftActions";

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

describe("a GIF picked in the web composer", () => {
    afterEach(() => localUpdates.draftMessages.delete(here));

    const gif = { kind: "giphy_content", title: "cat" } as GiphyContent;
    const draft = () => localUpdates.draftMessages.value.get(here);

    test("is the draft's attachment, to go out with Send, keeping its text and reply", () => {
        localUpdates.draftMessages.setTextContent(here, "so true");
        localUpdates.draftMessages.setReplyingTo(here, reply(here));
        attachGif(here, gif);
        expect(draft()?.attachment).toBe(gif);
        expect(draft()?.textContent).toBe("so true");
        expect(draft()?.replyingTo).toEqual(reply(here));
    });

    test("takes the place of what was attached, as a file picked does", () => {
        localUpdates.draftMessages.setAttachment(here, {
            kind: "file_content",
        } as AttachmentContent);
        attachGif(here, gif);
        expect(draft()?.attachment).toBe(gif);
    });

    test("is attached in its own chat or thread only", () => {
        attachGif(here, gif);
        expect(localUpdates.draftMessages.value.get(elsewhere)?.attachment).toBeUndefined();
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
