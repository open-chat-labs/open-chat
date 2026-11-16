import type {
    EventWrapper,
    GiphyContent,
    ImageContent,
    KlipyObject,
    Message,
    MessageContent,
    VideoContent,
} from "@client";
import type { ConversationContext } from "@src/logic/conversation/messageRow";
import {
    composerAttachment,
    composerContext,
    composerGif,
    composerGifs,
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
    longDate: (timestamp) => `L${timestamp}`,
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
    avatar: () => undefined,
    unreadInThread: () => 0,
    threads: true,
    undeleting: () => false,
    referralLink: "https://oc.app/?ref=me",
    twitchParent: "oc.app",
    proposalTopics: new Map(),
    proposalVote: () => undefined,
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

describe("a media reply's thumbnail in the strip", () => {
    const base = {
        kind: "rehydrated_reply_context" as const,
        senderId: "alice",
        eventIndex: 3,
        messageId: 42n,
        messageIndex: 2,
        edited: false,
        isThreadRoot: false,
        sourceContext: { chatId: { kind: "group_chat" as const, groupId: "g" } },
    };
    const image: ImageContent = {
        kind: "image_content",
        width: 10,
        height: 10,
        thumbnailData: "data:thumb",
        mimeType: "image/jpeg",
        blobUrl: "https://blob/image",
    };
    const video: VideoContent = {
        kind: "video_content",
        width: 10,
        height: 10,
        thumbnailData: "data:vthumb",
        mimeType: "video/mp4",
        imageData: { blobUrl: "https://blob/frame" },
        videoData: { blobUrl: "https://blob/video" },
    };
    const gif: GiphyContent = {
        kind: "giphy_content",
        title: "cat",
        desktop: { width: 10, height: 10, url: "https://gif/desktop.mp4", mimeType: "video/mp4" },
        mobile: { width: 10, height: 10, url: "https://gif/tiny.gif", mimeType: "image/gif" },
    };
    const strip = (content: MessageContent, media = ctx.media) =>
        composerContext({ replyingTo: { ...base, content } }, { ...ctx, media }, undefined);

    test("a photo shows its picture", () => {
        expect(strip(image)).toMatchObject({
            thumb: 'center/cover no-repeat url("https://blob/image")',
        });
        expect(strip(image)?.thumbVideo).toBeUndefined();
    });

    test("a video shows its first frame, with a play glyph", () => {
        expect(strip(video)).toMatchObject({
            thumb: 'center/cover no-repeat url("https://blob/frame")',
            thumbVideo: true,
        });
    });

    test("a GIF shows its small rendition", () => {
        expect(strip(gif)?.thumb).toBe('center/cover no-repeat url("https://gif/tiny.gif")');
    });

    test("in low bandwidth, a photo not revealed shows its thumbnail, a GIF none", () => {
        const low = { lowBandwidth: true, revealed: () => false, url: (u?: string) => u };
        expect(strip(image, low)?.thumb).toBe('center/cover no-repeat url("data:thumb")');
        expect(strip(gif, low)?.thumb).toBeUndefined();
        const revealed = { ...low, revealed: (id: bigint) => id === 42n };
        expect(strip(image, revealed)?.thumb).toBe(
            'center/cover no-repeat url("https://blob/image")',
        );
    });

    test("a photo with no full-size picture shows its thumbnail", () => {
        expect(strip({ ...image, blobUrl: undefined })?.thumb).toBe(
            'center/cover no-repeat url("data:thumb")',
        );
    });

    test("text and files have none", () => {
        expect(strip({ kind: "text_content", text: "hi" })?.thumb).toBeUndefined();
        expect(
            strip({ kind: "file_content", name: "a.pdf", mimeType: "application/pdf", fileSize: 1 })
                ?.thumb,
        ).toBeUndefined();
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

describe("the GIFs the composer's GIF tab shows", () => {
    const format = (url: string, dims: number[]) => ({ url, dims, duration: 0, size: 1 });
    const found = (id: string, title = `GIF ${id}`, about = `about ${id}`): KlipyObject => ({
        id,
        title,
        content_description: about,
        created: 0,
        flags: [],
        hasaudio: false,
        itemurl: "",
        tags: [],
        url: "",
        media_formats: {
            tinygif: format(`${id}.gif`, [220, 124]),
            mp4: format(`${id}.mp4`, [480, 270]),
        } as KlipyObject["media_formats"],
    });

    test("a GIF is its small rendition, shaped as it is, named by its title or description", () => {
        expect(composerGif(found("a"), "GIF")).toEqual({
            key: "a",
            src: "a.gif",
            width: 220,
            height: 124,
            title: "GIF a",
        });
        expect(composerGif(found("b", ""), "GIF").title).toBe("about b");
    });

    test("a GIF with neither a title nor a description is still named, generically", () => {
        expect(composerGif(found("c", "", ""), "GIF").title).toBe("GIF");
        const feed = { gifs: [found("c", "", "")], loading: false, failed: false };
        expect(composerGifs({ ...feed, notFound: undefined }, "GIF").items[0].title).toBe("GIF");
    });

    test("says whether a page is on its way or failed", () => {
        const feed = { gifs: [found("a")], loading: false, failed: false, notFound: undefined };
        expect(composerGifs(feed, "GIF")).toEqual({
            items: [composerGif(found("a"), "GIF")],
            status: "idle",
        });
        expect(composerGifs({ ...feed, loading: true }, "GIF").status).toBe("loading");
        expect(composerGifs({ ...feed, failed: true }, "GIF").status).toBe("failed");
    });

    test("a search that found none has its related terms, or none with the trending GIFs", () => {
        const none = { gifs: [], loading: false, failed: false };
        expect(
            composerGifs(
                {
                    ...none,
                    notFound: { kind: "suggestions", query: "zzz", terms: ["cats", "dogs"] },
                },
                "GIF",
            ).notFound,
        ).toEqual({ query: "zzz", terms: ["cats", "dogs"] });
        expect(
            composerGifs({ ...none, notFound: { kind: "trending", query: "zzz" } }, "GIF").notFound,
        ).toEqual({ query: "zzz", terms: [] });
    });
});
