import { PremiumItem, type EventWrapper, type Message, type MessageContent } from "@shared";
import {
    emojiReaction,
    messageMenu,
    messageReplyContext,
    type MessageMenuAction,
    type MessageMenuInput,
} from "./messageMenu";

const ME = "me";
const THEM = "them";
const NOW = 1_000_000_000;

function text(t = "hello"): MessageContent {
    return { kind: "text_content", text: t };
}

function input(overrides: Partial<MessageMenuInput> = {}): MessageMenuInput {
    return {
        message: {
            messageId: 1n,
            sender: THEM,
            senderContext: undefined,
            content: text(),
            deleted: false,
        },
        userId: ME,
        showAsMe: false,
        chatKind: "group_chat",
        publicGroup: true,
        confirmed: true,
        failed: false,
        collapsed: false,
        readonly: false,
        ephemeral: false,
        pinned: false,
        translated: false,
        undeleting: false,
        now: NOW,
        thread: undefined,
        supportsEdit: true,
        supportsReply: true,
        shareable: true,
        tipRecipient: THEM,
        tipsEnabled: true,
        permissions: {
            send: true,
            react: true,
            pin: true,
            tip: true,
            deleteOthers: false,
            blockSender: true,
            startThread: true,
        },
        ...overrides,
    };
}

function mine(overrides: Partial<MessageMenuInput> = {}): MessageMenuInput {
    const base = input(overrides);
    return { ...base, showAsMe: true, message: { ...base.message, sender: ME } };
}

function withContent(content: MessageContent, base = input()): MessageMenuInput {
    return { ...base, message: { ...base.message, content } };
}

const deletedBy = (userId: string, at: number): MessageContent => ({
    kind: "deleted_content",
    deletedBy: userId,
    timestamp: BigInt(at),
});

describe("a message's actions", () => {
    test("someone else's message in a group offers what the old menus offered", () => {
        expect([...messageMenu(input()).actions].sort()).toEqual(
            [
                "block_user",
                "copy",
                "copy_url",
                "forward",
                "pin",
                "remind",
                "reply",
                "reply_privately",
                "report",
                "share",
                "start_thread",
                "tip",
                "translate",
            ].sort(),
        );
    });

    test("your own message offers edit and delete, and nothing aimed at its author", () => {
        const actions = messageMenu(mine()).actions;
        expect(actions.has("edit")).toBe(true);
        expect(actions.has("delete")).toBe(true);
        const aimedAtAuthor: MessageMenuAction[] = [
            "tip",
            "report",
            "block_user",
            "reply_privately",
            "translate",
        ];
        for (const action of aimedAtAuthor) {
            expect(actions.has(action)).toBe(false);
        }
    });

    test("someone else's message in a DM is deleted for you only", () => {
        const actions = messageMenu(
            input({
                chatKind: "direct_chat",
                permissions: { ...input().permissions, deleteOthers: true },
            }),
        ).actions;
        expect(actions.has("delete_for_me")).toBe(true);
        expect(actions.has("delete")).toBe(false);
    });

    test("a failed message can be retried or deleted, and nothing else that needs it sent", () => {
        const actions = messageMenu(mine({ failed: true, confirmed: false })).actions;
        expect(actions.has("retry")).toBe(true);
        expect(actions.has("delete")).toBe(true);
        const needSending: MessageMenuAction[] = [
            "edit",
            "reply",
            "pin",
            "forward",
            "remind",
            "copy_url",
        ];
        for (const action of needSending) {
            expect(actions.has(action)).toBe(false);
        }
    });

    test("translating is offered until it's translated, then untranslating", () => {
        expect(messageMenu(input()).actions.has("translate")).toBe(true);
        const translated = messageMenu(input({ translated: true })).actions;
        expect(translated.has("untranslate")).toBe(true);
        expect(translated.has("translate")).toBe(false);
        expect(messageMenu(withContent(text(""))).actions.has("translate")).toBe(false);
    });

    test("a reminder is offered on a message, and cancelling one on the reminder while it's to come", () => {
        const reminder: MessageContent = {
            kind: "message_reminder_created_content",
            reminderId: 1n,
            remindAt: NOW + 1,
            notes: undefined,
            hidden: false,
        };
        const actions = messageMenu(withContent(reminder)).actions;
        expect(actions.has("cancel_reminder")).toBe(true);
        expect(actions.has("remind")).toBe(false);
        expect(
            messageMenu(withContent({ ...reminder, remindAt: NOW - 1 })).actions.has(
                "cancel_reminder",
            ),
        ).toBe(false);
    });

    test("a relayed message offers no private reply, which would go to the bridge bot", () => {
        const base = input();
        const relayed = messageMenu({
            ...base,
            message: {
                ...base.message,
                senderContext: {
                    kind: "bot",
                    finalised: true,
                    bridgedFrom: { kind: "telegram", id: "42" },
                },
            },
        });
        expect(relayed.actions.has("reply_privately")).toBe(false);
    });

    test("no menu in a chat that can only be read, or on an ephemeral message", () => {
        expect(messageMenu(input({ readonly: true })).menu).toBe(false);
        expect(messageMenu(input({ readonly: true })).actions.size).toBe(0);
        expect(messageMenu(input({ ephemeral: true })).menu).toBe(false);
    });

    test("no menu on a deleted message unless it can be revealed", () => {
        const deleted = messageMenu(withContent(deletedBy(THEM, NOW)));
        expect(deleted.inert).toBe(true);
        expect(deleted.menu).toBe(false);
        expect(messageMenu(withContent({ kind: "blocked_content" })).actions.has("reveal")).toBe(
            true,
        );
    });

    // invariant 2
    test("tip is never offered on your own, unconfirmed, failed, inert or bridged message, or without the tip permission", () => {
        const tips = (i: MessageMenuInput) => messageMenu(i).actions.has("tip");
        expect(tips(input())).toBe(true);
        expect(tips(mine({ tipRecipient: ME }))).toBe(false);
        expect(tips(input({ confirmed: false }))).toBe(false);
        expect(tips(input({ failed: true }))).toBe(false);
        expect(tips(withContent({ kind: "blocked_content" }))).toBe(false);
        // a relayed message no member has linked has no one to pay (tipRecipient)
        expect(tips(input({ tipRecipient: undefined }))).toBe(false);
        // relayed from the reader's own linked account
        expect(tips(input({ tipRecipient: ME }))).toBe(false);
        expect(tips(input({ permissions: { ...input().permissions, tip: false } }))).toBe(false);
        expect(tips(input({ tipsEnabled: false }))).toBe(false);
        expect(messageMenu(input({ tipsEnabled: false })).canTip).toBe(false);
    });

    // invariant 6
    test("undelete and reveal are offered only for your own deletion within 5 minutes; delete isn't offered on a call in progress", () => {
        const deleted = (at: number) => withContent(deletedBy(ME, at), mine());
        expect(messageMenu(deleted(NOW - 60_000)).actions.has("reveal")).toBe(true);
        expect(messageMenu(deleted(NOW - 6 * 60_000)).actions.has("reveal")).toBe(false);
        expect(messageMenu(deleted(NOW - 6 * 60_000)).menu).toBe(false);
        expect(messageMenu(withContent(deletedBy(THEM, NOW))).actions.has("reveal")).toBe(false);
        expect(
            messageMenu({ ...deleted(NOW - 60_000), undeleting: true }).actions.has("reveal"),
        ).toBe(false);

        // revealed (deleted, with its content back): undelete
        const revealed = mine();
        expect(
            messageMenu({
                ...revealed,
                message: { ...revealed.message, deleted: true },
            }).actions.has("undelete"),
        ).toBe(true);
        expect(messageMenu(mine()).actions.has("undelete")).toBe(false);

        const call = (ended: bigint | undefined): MessageContent => ({
            kind: "video_call_content",
            participants: [],
            ended,
            callType: "default",
        });
        expect(messageMenu(withContent(call(undefined), mine())).actions.has("delete")).toBe(
            false,
        );
        expect(messageMenu(withContent(call(1n), mine())).actions.has("delete")).toBe(true);
    });

    // invariant 7
    test("pin and unpin are never offered in a thread or a DM", () => {
        const pins = (i: MessageMenuInput) => {
            const actions = messageMenu(i).actions;
            return actions.has("pin") || actions.has("unpin");
        };
        expect(pins(input())).toBe(true);
        expect(messageMenu(input({ pinned: true })).actions.has("unpin")).toBe(true);
        expect(pins(input({ thread: { following: false } }))).toBe(false);
        expect(pins(input({ pinned: true, thread: { following: true } }))).toBe(false);
        expect(pins(input({ chatKind: "direct_chat" }))).toBe(false);
        expect(pins(input({ chatKind: "direct_chat", pinned: true }))).toBe(false);
    });

    test("in a thread: follow or unfollow it, and no thread of its own, forward or private reply", () => {
        const following = messageMenu(input({ thread: { following: true } })).actions;
        expect(following.has("unfollow_thread")).toBe(true);
        expect(following.has("start_thread")).toBe(false);
        expect(following.has("forward")).toBe(false);
        expect(following.has("reply_privately")).toBe(false);
        expect(
            messageMenu(input({ thread: { following: false } })).actions.has("follow_thread"),
        ).toBe(true);
    });

    test("reactions follow the permission, and not on an inert or failed message", () => {
        expect(messageMenu(input()).react).toBe(true);
        expect(
            messageMenu(input({ permissions: { ...input().permissions, react: false } })).react,
        ).toBe(false);
        expect(messageMenu(withContent({ kind: "blocked_content" })).react).toBe(false);
        expect(messageMenu(mine({ failed: true })).react).toBe(false);
    });

    test("a block is offered in a group only, for a sender who isn't shown as you", () => {
        expect(messageMenu(input()).actions.has("block_user")).toBe(true);
        expect(messageMenu(input({ chatKind: "channel" })).actions.has("block_user")).toBe(
            false,
        );
        expect(messageMenu(input({ showAsMe: true })).actions.has("block_user")).toBe(false);
    });
});

describe("a reaction from the emoji picker", () => {
    test("is the emoji itself, or a custom one by its code", () => {
        expect(emojiReaction({ kind: "native", unicode: "👍" })).toBe("👍");
        expect(
            emojiReaction({
                kind: "custom",
                code: "bots_wave",
                url: "",
                filename: "",
                premiumItem: PremiumItem.BotEmojis,
            }),
        ).toBe("@CE(bots_wave)");
    });
});

describe("a reply's context", () => {
    test("quotes the message where it was sent", () => {
        const evt: EventWrapper<Message> = {
            index: 7,
            timestamp: 0n,
            event: {
                kind: "message",
                messageId: 3n,
                messageIndex: 5,
                sender: THEM,
                content: text(),
                reactions: [],
                tips: {},
                edited: true,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
                ogPreviews: [],
                messagePreviews: [],
            },
        };
        const context = { chatId: { kind: "group_chat" as const, groupId: "g" } };
        expect(messageReplyContext(evt, undefined, context)).toMatchObject({
            kind: "rehydrated_reply_context",
            senderId: THEM,
            eventIndex: 7,
            messageId: 3n,
            messageIndex: 5,
            edited: true,
            isThreadRoot: false,
            sourceContext: context,
        });
    });
});
