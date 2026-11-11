import type { EventWrapper, Message } from "@client";
import type { ConversationContext } from "@src/logic/conversation/messageRow";
import {
    composerAttachment,
    composerContext,
    composerMention,
    composerStartText,
} from "./composerProps";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
    mentionsAsTyped: (text) => text.replace(/@UserId\((\w+)\)/g, "@$1"),
    time: (timestamp) => `t${timestamp}`,
    date: (timestamp) => `d${timestamp}`,
    media: { lowBandwidth: false, revealed: () => false, url: (u) => u },
    direct: false,
    readonly: false,
    now: 0,
    claimant: {
        previewingOrLapsed: false,
        diamond: false,
        lifetimeDiamond: false,
        streak: 0,
        chitEarned: 0,
        accountCreated: 0,
    },
    text: (key) => key.key,
    openThread: undefined,
    face: (userId) => `face:${userId}`,
    unreadInThread: () => 0,
    threads: true,
    token: (ledger) =>
        ledger === "icp"
            ? {
                  symbol: "ICP",
                  logo: "icp.svg",
                  amount: (e8s) => String(Number(e8s) / 1e8),
                  usd: () => "$1",
              }
            : undefined,
};

function message(fields: Partial<Message> = {}): EventWrapper<Message> {
    return {
        index: 3,
        timestamp: 7n,
        event: {
            kind: "message",
            messageId: 42n,
            messageIndex: 2,
            sender: "alice",
            content: { kind: "text_content", text: "hi" },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
            ...fields,
        },
    } as unknown as EventWrapper<Message>;
}

describe("the composer's reply or edit strip", () => {
    const quoted = message().event;
    const replyingTo = {
        kind: "rehydrated_reply_context" as const,
        senderId: "alice",
        eventIndex: 3,
        content: quoted.content,
        messageId: 42n,
        messageIndex: 2,
        edited: false,
        isThreadRoot: false,
        sourceContext: { chatId: { kind: "group_chat" as const, groupId: "g" } },
    };

    test("is none without a reply or an edit", () => {
        expect(composerContext(undefined, ctx, undefined)).toBeNull();
        expect(composerContext({}, ctx, undefined)).toBeNull();
    });

    test("quotes the message replied to, with who wrote it", () => {
        expect(composerContext({ replyingTo }, ctx, undefined)).toEqual({
            key: "reply:42",
            mode: "reply",
            name: "Alice",
            quote: "hi",
        });
        expect(
            composerContext({ replyingTo: { ...replyingTo, senderId: "me" } }, ctx, undefined)
                ?.name,
        ).toBe("You");
    });

    test("a quote shows its mentions as the @names typed", () => {
        const mentioning = {
            ...replyingTo,
            content: { kind: "text_content" as const, text: "ask @UserId(bob)" },
        };
        expect(composerContext({ replyingTo: mentioning }, ctx, undefined)?.quote).toBe("ask @bob");
    });

    test("an edit starts from the text it's given and takes the place of the message's own reply", () => {
        const editing = message({
            sender: "me",
            content: { kind: "text_content", text: "hi @UserId(alice)" },
        });
        expect(composerContext({ editingEvent: editing, replyingTo }, ctx, "hi @alice")).toEqual({
            key: "edit:42",
            mode: "edit",
            quote: "hi @alice",
            text: "hi @alice",
        });
    });
});

describe("someone the composer offers to mention", () => {
    const avatar = (u: { userId: string }) => `https://avatar/${u.userId}`;
    const alice = {
        kind: "user" as const,
        userId: "a",
        username: "alice",
        displayName: "Ally",
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive" as const,
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };

    test("is picked by the name typed to mention them, and shown by their display name", () => {
        expect(composerMention(alice, avatar)).toEqual({
            key: "a",
            handle: "alice",
            name: "Ally",
            avatar: "https://avatar/a",
        });
        expect(composerMention({ ...alice, displayName: undefined }, avatar).name).toBe("alice");
    });

    test("a group, or everyone, is its name with the group icon", () => {
        expect(
            composerMention({ kind: "user_group", id: 3, name: "devs", memberCount: 2 }, avatar),
        ).toEqual({ key: "3", handle: "devs", name: "devs", group: true });
        expect(composerMention({ kind: "everyone" }, avatar)).toEqual({
            key: "everyone",
            handle: "everyone",
            name: "everyone",
            group: true,
        });
    });
});

describe("the composer's staged attachment", () => {
    const data = { blobData: new Uint8Array(2048), blobUrl: "blob:x" };

    test("a photo, video or GIF goes in the media tray, one to a message", () => {
        expect(
            composerAttachment(
                {
                    kind: "image_content",
                    ...data,
                    height: 1,
                    width: 1,
                    thumbnailData: "THUMB",
                    mimeType: "image/jpeg",
                },
                ctx,
            ),
        ).toEqual({ type: "media", items: [{ kind: "image", src: "blob:x" }] });
        expect(
            composerAttachment(
                {
                    kind: "video_content",
                    height: 1,
                    width: 1,
                    thumbnailData: "THUMB",
                    mimeType: "video/mp4",
                    imageData: {},
                    videoData: { blobUrl: "blob:v" },
                },
                ctx,
            ),
        ).toEqual({ type: "media", items: [{ kind: "video", src: "blob:v" }] });
        expect(
            composerAttachment(
                {
                    kind: "giphy_content",
                    title: "cat",
                    desktop: {
                        url: "https://g/full.mp4",
                        width: 4,
                        height: 3,
                        mimeType: "video/mp4",
                    },
                    mobile: {
                        url: "https://g/full.gif",
                        width: 4,
                        height: 3,
                        mimeType: "image/gif",
                    },
                },
                ctx,
            ),
        ).toEqual({ type: "media", items: [{ kind: "image", src: "https://g/full.gif" }] });
    });

    test("a file or an audio clip is a chip with its size", () => {
        expect(
            composerAttachment(
                {
                    kind: "file_content",
                    ...data,
                    name: "notes.pdf",
                    mimeType: "application/pdf",
                    fileSize: 2048,
                },
                ctx,
            ),
        ).toEqual({ type: "file", title: "notes.pdf", summary: "2.0 KB" });
        expect(
            composerAttachment(
                {
                    kind: "audio_content",
                    ...data,
                    mimeType: "audio/mp4",
                    samples: new Uint8Array(),
                    durationMs: 1000n,
                },
                ctx,
            ),
        ).toMatchObject({ type: "file", summary: "2.0 KB" });
    });

    test("is none without one, or for what the composer doesn't stage yet", () => {
        expect(composerAttachment(undefined, ctx)).toBeNull();
        expect(
            composerAttachment(
                {
                    kind: "daily_result",
                    gameId: "g",
                    number: 1,
                    userId: "me",
                    solveTimeMs: 1,
                    hintsUsed: 0,
                    streak: 1,
                    layout: "",
                },
                ctx,
            ),
        ).toBeNull();
    });
});

describe("the text the composer starts from", () => {
    test("is the chat's draft", () => {
        expect(composerStartText(undefined)).toBe("");
        expect(composerStartText({ textContent: "hello" })).toBe("hello");
    });

    test("mid-edit, is what was being written before the edit, not the edited message", () => {
        const editing = message({ sender: "me", content: { kind: "text_content", text: "old" } });
        expect(
            composerStartText({
                editingEvent: editing,
                textContent: "old",
                beforeEdit: { textContent: "hello" },
            }),
        ).toBe("hello");
        expect(composerStartText({ editingEvent: editing, textContent: "old" })).toBe("");
    });
});
