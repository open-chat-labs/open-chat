import type { ChatIdentifier, CommunityIdentifier, EventWrapper, Message } from "@shared";
import { vi } from "vitest";
import { chatSummaryLocalUpdates } from "./chat/summaryUpdates";
import { communitySummaryLocalUpdates } from "./community/summaryUpdates";
import { localUpdates } from "./localUpdates";
import { messageLocalUpdates } from "./message/localUpdates";

vi.useFakeTimers();

const chatId: ChatIdentifier = { kind: "group_chat", groupId: "123456" };
const communityId: CommunityIdentifier = { kind: "community", communityId: "123456" };

function message(): EventWrapper<Message> {
    return {
        index: 1,
        timestamp: 1n,
        expiresAt: undefined,
        event: {
            kind: "message",
            messageId: 1n,
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

describe("undoing local summary / message updates", () => {
    beforeEach(() => {
        localUpdates.clearAll();
    });

    describe("chat summary updates", () => {
        test("undo blanks the updated field", () => {
            const undo = localUpdates.updateChatProperties(chatId, "new name");
            expect(chatSummaryLocalUpdates.value.get(chatId)?.name).toEqual("new name");
            undo();
            expect(chatSummaryLocalUpdates.value.get(chatId)?.name).toBeUndefined();
        });

        test("undo removes the entry once nothing is left in it", () => {
            const undo = localUpdates.updateLatestMessage(chatId, message());
            expect(chatSummaryLocalUpdates.value.get(chatId)).not.toBeUndefined();
            undo();
            expect(chatSummaryLocalUpdates.value.get(chatId)).toBeUndefined();
        });

        test("undo keeps the entry while other fields are still set", () => {
            const undoName = localUpdates.updateChatProperties(chatId, "new name");
            const undoFrozen = localUpdates.updateChatFrozen(chatId, true);
            undoName();
            const entry = chatSummaryLocalUpdates.value.get(chatId);
            expect(entry).not.toBeUndefined();
            expect(entry?.frozen).toBe(true);
            expect(entry?.name).toBeUndefined();
            undoFrozen();
            expect(chatSummaryLocalUpdates.value.get(chatId)).toBeUndefined();
        });

        test("the scheduled undo also removes the entry", () => {
            localUpdates.updateArchived(chatId, true);
            expect(chatSummaryLocalUpdates.value.get(chatId)?.archived).toBe(true);
            vi.runAllTimers();
            expect(chatSummaryLocalUpdates.value.get(chatId)).toBeUndefined();
        });

        test("a new update after undo starts a fresh entry", () => {
            const undo = localUpdates.updateChatProperties(chatId, "new name");
            undo();
            localUpdates.updateChatFrozen(chatId, true);
            const entry = chatSummaryLocalUpdates.value.get(chatId);
            expect(entry?.frozen).toBe(true);
            expect(entry?.name).toBeUndefined();
        });
    });

    describe("message updates", () => {
        test("undo of a tip removes the entry", () => {
            const undo = localUpdates.markTip(1n, "ledger", "user1", 100n);
            expect(messageLocalUpdates.value.get(1n)?.tips.size).toBe(1);
            undo();
            expect(messageLocalUpdates.value.get(1n)).toBeUndefined();
        });

        test("undo of a reaction removes the entry", () => {
            const undo = localUpdates.markReaction(1n, {
                reaction: "x",
                kind: "add",
                userId: "user1",
            });
            expect(messageLocalUpdates.value.get(1n)?.reactions.length).toBe(1);
            undo();
            expect(messageLocalUpdates.value.get(1n)).toBeUndefined();
        });

        test("undo keeps the entry while other updates remain", () => {
            const undoTip = localUpdates.markTip(1n, "ledger", "user1", 100n);
            localUpdates.markPrizeClaimed(1n);
            undoTip();
            const entry = messageLocalUpdates.value.get(1n);
            expect(entry?.prizeClaimed).toBe(true);
            expect(entry?.tips.size).toBe(0);
        });
    });

    describe("community summary updates", () => {
        test("undo removes the entry once nothing is left in it", () => {
            const undo = localUpdates.updateCommunityDisplayName(communityId, "name");
            expect(communitySummaryLocalUpdates.value.get(communityId)).not.toBeUndefined();
            undo();
            expect(communitySummaryLocalUpdates.value.get(communityId)).toBeUndefined();
        });
    });
});
