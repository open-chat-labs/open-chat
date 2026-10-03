import type {
    CryptocurrencyContent,
    DirectChatIdentifier,
    EnhancedReplyContext,
    GroupChatIdentifier,
} from "@shared";
import { describe, expect, test } from "vitest";
import { createDraftMessagesStore } from "./draft";

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });
const group: GroupChatIdentifier = { kind: "group_chat", groupId: "g1" };

const transferTo = (recipient: string): CryptocurrencyContent => ({
    kind: "crypto_content",
    transfer: {
        kind: "pending",
        ledger: "ledger",
        token: "ICP",
        recipient,
        amountE8s: 100n,
        createdAtNanos: 1n,
    },
});

const replyTo = (chatId: DirectChatIdentifier | GroupChatIdentifier) =>
    ({
        kind: "rehydrated_reply_context",
        messageIndex: 3,
        sourceContext: { chatId },
    }) as EnhancedReplyContext;

describe("draft messages moveChat", () => {
    test("moves the drafts for the chat and its threads onto the new id", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent({ chatId: direct("old") }, "hello");
        drafts.setTextContent({ chatId: direct("old"), threadRootMessageIndex: 5 }, "in a thread");
        drafts.setTextContent({ chatId: direct("other") }, "untouched");

        drafts.moveChat(direct("old"), direct("new"));

        expect(drafts.value.get({ chatId: direct("old") })).toBeUndefined();
        expect(drafts.value.get({ chatId: direct("new") })?.textContent).toBe("hello");
        expect(
            drafts.value.get({ chatId: direct("new"), threadRootMessageIndex: 5 })?.textContent,
        ).toBe("in a thread");
        expect(drafts.value.get({ chatId: direct("other") })?.textContent).toBe("untouched");
    });

    test("points a reply to a message in the moved chat at the new id", () => {
        const drafts = createDraftMessagesStore();
        drafts.setReplyingTo({ chatId: direct("old") }, replyTo(direct("old")));

        drafts.moveChat(direct("old"), direct("new"));

        expect(
            drafts.value.get({ chatId: direct("new") })?.replyingTo?.sourceContext.chatId,
        ).toEqual(direct("new"));
    });

    test("leaves a reply to a message in another chat as it is", () => {
        const drafts = createDraftMessagesStore();
        drafts.setReplyingTo({ chatId: direct("old") }, replyTo(group));

        drafts.moveChat(direct("old"), direct("new"));

        expect(
            drafts.value.get({ chatId: direct("new") })?.replyingTo?.sourceContext.chatId,
        ).toEqual(group);
    });

    test("addresses a draft transfer to the other user to their new id", () => {
        const drafts = createDraftMessagesStore();
        drafts.setAttachment({ chatId: direct("old") }, transferTo("old"));

        drafts.moveChat(direct("old"), direct("new"));

        expect(drafts.value.get({ chatId: direct("new") })?.attachment).toEqual(transferTo("new"));
    });

    test("keeps a draft already held for the new id", () => {
        const drafts = createDraftMessagesStore();
        drafts.setTextContent({ chatId: direct("old") }, "older");
        drafts.setTextContent({ chatId: direct("new") }, "newer");

        drafts.moveChat(direct("old"), direct("new"));

        expect(drafts.value.get({ chatId: direct("old") })).toBeUndefined();
        expect(drafts.value.get({ chatId: direct("new") })?.textContent).toBe("newer");
    });
});
