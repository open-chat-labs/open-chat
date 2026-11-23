import type { ChatSummary, EventWrapper, Message, MessageMenu, MessageMenuAction } from "@client";
import {
    guestMessageAction,
    isRevealedDeleted,
    messageOffer,
    peekOffer,
    type MessageOfferState,
} from "./messageOffer";

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
        queued: new Map<string, Set<bigint>>(),
        confirmed: true,
        readonly: true,
        guest,
        pinned: new Set<number>(),
        translated: new Set<bigint>(),
        undeleting: new Set<bigint>(),
        blocked: new Set<string>(),
        tipsEnabled: true,
        tipRecipient: "them",
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

describe("tipping a message", () => {
    // a member who may do everything, tipping included
    const member = {
        canSendMessage: () => true,
        canReactToMessages: () => true,
        canPinMessages: () => true,
        canTipMessages: () => true,
        canDeleteOtherUsersMessages: () => true,
        canBlockUsers: () => true,
    };
    const writable = (patch: Partial<MessageOfferState> = {}): MessageOfferState => ({
        ...state(false),
        readonly: false,
        ...patch,
    });

    test("is offered on someone else's message, to whoever it pays", () => {
        const offer = messageOffer(member, group, theirs, writable());
        expect(offer.canTip).toBe(true);
        expect(offer.actions).toContain("tip");
    });

    test("is offered in a thread too, by the tip permission", () => {
        const root = { messageId: 99n, messageIndex: 1 };
        const offer = messageOffer(
            member,
            group,
            theirs,
            writable({ thread: { root, following: true } }),
        );
        expect(offer.actions).toContain("tip");
        const noTip = messageOffer(
            { ...member, canTipMessages: () => false },
            group,
            theirs,
            writable({ thread: { root, following: true } }),
        );
        expect(noTip.actions).not.toContain("tip");
    });

    test("is never offered in an app store build", () => {
        const offer = messageOffer(member, group, theirs, writable({ tipsEnabled: false }));
        expect(offer.canTip).toBe(false);
        expect(offer.actions).not.toContain("tip");
    });

    test("is never offered with no one to pay (a bot's, or a relayed message no one linked)", () => {
        const offer = messageOffer(member, group, theirs, writable({ tipRecipient: undefined }));
        expect(offer.canTip).toBe(false);
        expect(offer.actions).not.toContain("tip");
    });

    test("is never offered where it would pay the reader (their own relayed message)", () => {
        const offer = messageOffer(member, group, theirs, writable({ tipRecipient: "me" }));
        expect(offer.actions).not.toContain("tip");
    });

    test("is never offered on a failed or unconfirmed message", () => {
        expect(messageOffer(member, group, theirs, writable({ failed: true })).canTip).toBe(false);
        expect(messageOffer(member, group, theirs, writable({ confirmed: false })).canTip).toBe(
            false,
        );
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

describe("a revealed deleted message", () => {
    const text = { kind: "text_content", text: "hi" } as const;
    const everything: MessageMenu = {
        inert: false,
        menu: true,
        react: true,
        canEdit: true,
        canTip: true,
        actions: new Set<MessageMenuAction>([
            "reply",
            "forward",
            "copy",
            "pin",
            "start_thread",
            "remind",
            "report",
            "delete",
            "undelete",
            "edit",
        ]),
    };

    test("is a deleted message with its content back", () => {
        expect(isRevealedDeleted({ deleted: true, content: text })).toBe(true);
        expect(isRevealedDeleted({ deleted: false, content: text })).toBe(false);
        expect(
            isRevealedDeleted({
                deleted: true,
                content: { kind: "deleted_content", deletedBy: "me", timestamp: 1n },
            }),
        ).toBe(false);
    });

    test("is only peeked at: Undelete, Copy and Hide, no reactions, edits or tips, and no Info", () => {
        expect(peekOffer(everything, { deleted: true, content: text })).toEqual({
            inert: true,
            menu: true,
            react: false,
            canEdit: false,
            canTip: false,
            actions: new Set(["copy", "undelete", "hide"]),
        });
    });

    test("keeps only what messageMenu offered of Undelete and Copy", () => {
        const fewer = { ...everything, actions: new Set<MessageMenuAction>(["reply"]) };
        expect(peekOffer(fewer, { deleted: true, content: text }).actions).toEqual(
            new Set(["hide"]),
        );
    });

    test("has no Hide without a menu (a read-only chat)", () => {
        const none = { ...everything, menu: false, actions: new Set<MessageMenuAction>() };
        expect(peekOffer(none, { deleted: true, content: text }).actions).toEqual(new Set());
    });

    test("any other message offers what messageMenu says", () => {
        expect(peekOffer(everything, { deleted: false, content: text })).toBe(everything);
    });

    test("hiding it works signed out (it's this device's only)", () => {
        expect(guestMessageAction("hide")).toBe("run");
    });
});

describe("a message queued for the connection", () => {
    const mine: EventWrapper<Message> = { ...theirs, event: { ...theirs.event, sender: "me" } };
    const member = {
        canSendMessage: () => true,
        canReactToMessages: () => true,
        canPinMessages: () => false,
        canTipMessages: () => false,
        canDeleteOtherUsersMessages: () => false,
        canBlockUsers: () => false,
    };
    const failedState = (queued: boolean): MessageOfferState => ({
        ...state(false),
        readonly: false,
        failed: true,
        confirmed: false,
        queued: new Map([["chat", new Set(queued ? [mine.event.messageId] : [])]]),
    });

    test("offers no Retry: it goes on its own once the app is back online", () => {
        const offer = messageOffer(member, group, mine, failedState(true));
        expect(offer.actions).not.toContain("retry");
        expect(offer.actions).toContain("delete");
    });

    test("a failed one (a backend failure) offers Retry", () => {
        const offer = messageOffer(member, group, mine, failedState(false));
        expect(offer.actions).toContain("retry");
        expect(offer.actions).toContain("delete");
    });
});
