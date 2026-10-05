import type { ChatIdentifier, EventWrapper, Message, MessageContext } from "@shared";
import { localUpdates } from "./localUpdates";

const chatId: ChatIdentifier = { kind: "group_chat", groupId: "123456" };
const chatContext: MessageContext = { chatId };
const threadContext: MessageContext = { chatId, threadRootMessageIndex: 5 };

function message(messageId: bigint): EventWrapper<Message> {
    return {
        index: 1,
        timestamp: 1n,
        expiresAt: undefined,
        event: {
            kind: "message",
            messageId,
            messageIndex: 0,
            content: { kind: "text_content", text: "hi" },
            sender: "user1",
            reactions: [],
            deleted: false,
            edited: false,
            forwarded: false,
            blockLevelMarkdown: false,
            tips: {},
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

describe("failed messages", () => {
    beforeEach(() => {
        localUpdates.clearAll();
    });

    test("adding a failed message to a context with none records it", () => {
        const msg = message(1n);
        localUpdates.addFailedMessage(chatContext, msg);

        expect(localUpdates.failedMessagesForContext(chatContext)).toEqual([msg]);
        expect(localUpdates.anyFailed(chatContext)).toBe(true);
        expect(localUpdates.isFailed(chatContext, 1n)).toBe(true);
    });

    test("adding a failed message to a thread with none records it only for that thread", () => {
        const msg = message(1n);
        localUpdates.addFailedMessage(threadContext, msg);

        expect(localUpdates.failedMessagesForContext(threadContext)).toEqual([msg]);
        expect(localUpdates.anyFailed(threadContext)).toBe(true);
        expect(localUpdates.isFailed(threadContext, 1n)).toBe(true);
        expect(localUpdates.anyFailed(chatContext)).toBe(false);
        expect(localUpdates.isFailed(chatContext, 1n)).toBe(false);
    });

    test("adding a second failed message keeps the first", () => {
        localUpdates.addFailedMessage(chatContext, message(1n));
        localUpdates.addFailedMessage(chatContext, message(2n));

        expect(localUpdates.failedMessagesForContext(chatContext)).toHaveLength(2);
        expect(localUpdates.isFailed(chatContext, 1n)).toBe(true);
        expect(localUpdates.isFailed(chatContext, 2n)).toBe(true);
    });

    test("deleting the only failed message leaves none", () => {
        localUpdates.addFailedMessage(chatContext, message(1n));

        expect(localUpdates.deleteFailedMessage(chatContext, 1n)).toBe(true);
        expect(localUpdates.failedMessagesForContext(chatContext)).toEqual([]);
        expect(localUpdates.anyFailed(chatContext)).toBe(false);
        expect(localUpdates.isFailed(chatContext, 1n)).toBe(false);
    });
});
