import type { ChatSummary, EventWrapper, Message } from "@client";
import { guestMessageAction, messageOffer, type MessageOfferState } from "./messageOffer";

// a previewer can do nothing in the chat: every permission check says no
const previewer = {
    canSendMessage: () => false,
    canReactToMessages: () => false,
    canPinMessages: () => false,
    canTipMessages: () => false,
    canDeleteOtherUsersMessages: () => false,
    canBlockUsers: () => false,
};

const group = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "g1" },
    public: true,
} as ChatSummary;

const theirs: EventWrapper<Message> = {
    index: 10,
    timestamp: 0n,
    event: {
        kind: "message",
        messageId: 1n,
        messageIndex: 5,
        sender: "them",
        content: { kind: "text_content", text: "hello" },
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

function state(guest: boolean): MessageOfferState {
    return {
        me: guest ? "anon" : "me",
        bridgedUsers: new Map(),
        failed: false,
        confirmed: true,
        readonly: true,
        guest,
        pinned: new Set<number>(),
        translated: new Set<bigint>(),
        undeleting: new Set<bigint>(),
        blocked: new Set<string>(),
        tipsEnabled: true,
    };
}

describe("a message in a preview", () => {
    test("offers a guest what anyone with an account could do, and reactions", () => {
        const offer = messageOffer(previewer, group, theirs, state(true));
        expect(offer.menu).toBe(true);
        expect(offer.react).toBe(true);
        for (const action of ["copy", "copy_url", "reply", "start_thread", "forward", "report"]) {
            expect(offer.actions).toContain(action);
        }
    });

    test("offers a guest nothing a role gives, and no tip", () => {
        const offer = messageOffer(previewer, group, theirs, state(true));
        for (const action of ["pin", "delete", "block_user", "tip", "edit"]) {
            expect(offer.actions).not.toContain(action);
        }
    });

    test("stays read only for someone signed in who isn't a member", () => {
        const offer = messageOffer(previewer, group, theirs, state(false));
        expect(offer.menu).toBe(false);
        expect(offer.react).toBe(false);
        expect(offer.actions.size).toBe(0);
    });
});

describe("a guest's press on a message's action", () => {
    test("runs what works signed out: copying its text or link, sharing it, folding a proposal", () => {
        for (const action of ["copy", "copy_url", "share", "collapse_proposal"] as const) {
            expect(guestMessageAction(action)).toBe("run");
        }
    });

    test("asks to sign in for what needs an account, a translation (Diamond) included", () => {
        for (const action of [
            "reply",
            "start_thread",
            "forward",
            "reply_privately",
            "remind",
            "report",
            "follow_thread",
            "translate",
        ] as const) {
            expect(guestMessageAction(action)).toBe("sign_in");
        }
    });
});
