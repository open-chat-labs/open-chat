import {
    FIND_MEMBERS_DELAY_MS,
    ScreenWidth,
    type AttachmentContent,
    type ChatSummary,
    type DirectBotMessageOutcome,
    type MessageContext,
    type MessagePermission,
    type SendMessageOutcome,
    type UserGroupDetails,
    type UserOrUserGroup,
    type UserSummary,
} from "@client";
import {
    attachRefusal,
    canAttachNow,
    canRecordVoice,
    chatEntryState,
    composerAnswer,
    composerBuilders,
    attachmentToSend,
    draftAttachment,
    editStartText,
    entryBlock,
    entryBlockBanner,
    entryNotice,
    entryNoticeText,
    entryPlaceholder,
    focusEntryOnOpen,
    MemberFinder,
    mentionsFor,
    pickableAttachments,
    sendComposed,
    sendVoiceRecording,
    throttleCountdown,
    TypingNotifier,
    type ComposerBuilder,
    type EntryState,
} from "./composer";

/** Invariant: every tree's entry blocks sending for the same reasons, in the old footers' order. */
describe("why a message can't be sent", () => {
    const can: EntryState = {
        suspended: false,
        frozen: false,
        blocked: false,
        recipientSuspended: false,
        previewing: false,
        lapsed: false,
        direct: false,
        externalContent: false,
        anonymous: false,
        canSend: true,
        thread: false,
    };

    test("is nothing when it can", () => {
        expect(entryBlock(can)).toBeUndefined();
    });

    test("is the old footers' reason, in their order", () => {
        expect(entryBlock({ ...can, suspended: true, frozen: true })?.kind).toBe("suspended");
        expect(entryBlock({ ...can, frozen: true, blocked: true })?.kind).toBe("frozen");
        expect(entryBlock({ ...can, blocked: true, previewing: true })?.kind).toBe("blocked");
        // a preview offers Join, even signed out
        expect(entryBlock({ ...can, previewing: true, anonymous: true, canSend: false })).toEqual({
            kind: "preview",
            lapsed: false,
        });
        expect(entryBlock({ ...can, lapsed: true })).toEqual({ kind: "preview", lapsed: true });
        expect(entryBlock({ ...can, externalContent: true, canSend: false })?.kind).toBe(
            "external",
        );
        // a preview of an external channel still offers Join; signed out, it's the disclaimer
        expect(entryBlock({ ...can, previewing: true, externalContent: true })?.kind).toBe(
            "preview",
        );
        expect(
            entryBlock({ ...can, externalContent: true, anonymous: true, canSend: false })?.kind,
        ).toBe("external");
    });

    test("signed out is its own block; not allowed is read only, a thread's in a thread", () => {
        expect(entryBlock({ ...can, anonymous: true, canSend: false })).toEqual({
            kind: "anonymous",
        });
        expect(entryBlock({ ...can, canSend: false })).toEqual({
            kind: "read_only",
            key: "readOnlyChat",
        });
        expect(entryBlock({ ...can, canSend: false, thread: true })).toEqual({
            kind: "read_only",
            key: "readOnlyThread",
        });
    });

    test("a DM is never a preview", () => {
        expect(entryBlock({ ...can, direct: true, previewing: true })).toBeUndefined();
    });

    // a moderator's doing first: the reader's suspension, a freeze, then a DM's other user's
    test("a moderator's doing comes first, then what the reader can change", () => {
        const all: EntryState = {
            ...can,
            suspended: true,
            frozen: true,
            recipientSuspended: true,
            blocked: true,
            direct: true,
            canSend: false,
        };
        expect(entryBlock(all)?.kind).toBe("suspended");
        expect(entryBlock({ ...all, suspended: false })?.kind).toBe("frozen");
        // not the generic read only it also is (nothing may be sent to them), and before blocked,
        // as unblocking them wouldn't help
        expect(entryBlock({ ...all, suspended: false, frozen: false })?.kind).toBe(
            "recipient_suspended",
        );
        expect(
            entryBlock({ ...all, suspended: false, frozen: false, recipientSuspended: false })
                ?.kind,
        ).toBe("blocked");
    });
});

describe("telling others someone is typing", () => {
    let now = 0;
    let starts = 0;
    let stops = 0;
    let typing: TypingNotifier;

    beforeEach(() => {
        vi.useFakeTimers();
        now = 0;
        starts = 0;
        stops = 0;
        typing = new TypingNotifier(
            () => starts++,
            () => stops++,
            () => now,
        );
    });
    afterEach(() => vi.useRealTimers());

    test("says so at most once a second while they type", () => {
        typing.input("h");
        now = 500;
        typing.input("hi");
        expect(starts).toBe(1);
        now = 1200;
        typing.input("hi!");
        expect(starts).toBe(2);
    });

    test("says they've stopped after 5s without input", () => {
        typing.input("h");
        vi.advanceTimersByTime(4999);
        expect(stops).toBe(0);
        vi.advanceTimersByTime(1);
        expect(stops).toBe(1);
    });

    test("says they've stopped at once when the draft is emptied or sent, once", () => {
        typing.input("h");
        typing.input("");
        expect(stops).toBe(1);
        typing.stopped();
        vi.advanceTimersByTime(6000);
        expect(stops).toBe(1);
    });

    test("leaving forgets they were typing without telling anyone", () => {
        typing.input("h");
        typing.cancel();
        vi.advanceTimersByTime(6000);
        expect(stops).toBe(0);
        now = 100;
        typing.input("h");
        expect(starts).toBe(2);
    });

    test("starts again at once after stopping", () => {
        typing.input("h");
        typing.stopped();
        now = 100;
        typing.input("h");
        expect(starts).toBe(2);
    });
});

describe("the throttle countdown", () => {
    test("counts whole seconds up, never 0s while throttled, and ends at the deadline", () => {
        expect(throttleCountdown(10_000, 0)?.seconds).toBe(10);
        expect(throttleCountdown(10_000, 9_999)?.seconds).toBe(1);
        expect(throttleCountdown(10_000, 10_000)).toBeUndefined();
        expect(throttleCountdown(0, 5)).toBeUndefined();
    });
});

describe("the entry taking focus when a chat or thread opens", () => {
    test("happens from 992px up", () => {
        expect(focusEntryOnOpen(ScreenWidth.Large, false)).toBe(true);
        expect(focusEntryOnOpen(ScreenWidth.ExtraLarge, false)).toBe(true);
        expect(focusEntryOnOpen(ScreenWidth.ExtraExtraLarge, false)).toBe(true);
    });

    test("doesn't happen below that, where it would bring up the keyboard", () => {
        expect(focusEntryOnOpen(ScreenWidth.Medium, false)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.Small, false)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraSmall, false)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraExtraSmall, false)).toBe(false);
    });

    test("doesn't happen on a touch-only device (a tablet), whatever its width", () => {
        expect(focusEntryOnOpen(ScreenWidth.Large, true)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraLarge, true)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraExtraLarge, true)).toBe(false);
    });
});

/**
 * 5c invariant 3: an edit starts with each `@UserId(…)` / `@UserGroup(…)` as the `@name` it was
 * typed as and no link-disabled marker (saving expands them back: the client's typed mentions).
 */
describe("the text an edit starts from", () => {
    const user = (userId: string, username: string): UserSummary => ({
        kind: "user",
        userId,
        username,
        displayName: undefined,
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    });
    const users = new Map([
        ["u1", user("u1", "alice")],
        ["u2", user("u2", "bob")],
    ]);
    const groups = new Map<number, UserGroupDetails>([
        [7, { kind: "user_group", id: 7, name: "devs", members: new Set() }],
    ]);
    const edit = (text: string) => editStartText({ kind: "text_content", text }, users, groups);

    test("names each mentioned user and group as it was typed", () => {
        expect(edit("hi @UserId(u1) and @UserId(u2), @UserGroup(7)")).toBe(
            "hi @alice and @bob, @devs",
        );
    });

    test("leaves a mention it can't name as it is", () => {
        expect(edit("hi @UserId(nobody) @UserGroup(9)")).toBe("hi @UserId(nobody) @UserGroup(9)");
    });

    test("takes out the link-disabled marker", () => {
        expect(edit("see https://example.com#LINK_REMOVED")).toBe("see https://example.com");
    });

    test("is a captioned message's caption with its mentions as typed, nothing without text", () => {
        const image = {
            kind: "image_content",
            height: 1,
            width: 1,
            thumbnailData: "",
            mimeType: "image/png",
        } as const;
        expect(editStartText({ ...image, caption: "nice" }, users, groups)).toBe("nice");
        expect(editStartText({ ...image, caption: "for @UserId(u1)" }, users, groups)).toBe(
            "for @alice",
        );
        expect(editStartText(image, users, groups)).toBe("");
        expect(
            editStartText(
                { kind: "deleted_content", deletedBy: "u1", timestamp: 0n },
                users,
                groups,
            ),
        ).toBeUndefined();
    });
});

describe("a file that wasn't attached", () => {
    const formatter = (key: string) => `<${key}>`;

    test("names the permission it needs where it may not be sent", () => {
        expect(attachRefusal({ kind: "not_permitted", permission: "video" }, formatter)).toEqual(
            expect.objectContaining({
                key: "permissions.notPermitted",
                params: { permission: "<permissions.threadPermissions.video>" },
            }),
        );
    });

    test("says why it couldn't be prepared", () => {
        const message = { kind: "resource_key", key: "maxVideoSize", lowercase: false } as const;
        expect(attachRefusal({ kind: "failed", message }, formatter)).toBe(message);
    });
});

describe("what the entry offers to pick from the device", () => {
    const permitted = (...ps: MessagePermission[]) => new Set<MessagePermission>(ps);

    test("photos and videos where either may be sent, files where files may be", () => {
        expect(pickableAttachments(permitted("image", "video", "file"))).toEqual(["media", "file"]);
        expect(pickableAttachments(permitted("video"))).toEqual(["media"]);
        expect(pickableAttachments(permitted("file", "text"))).toEqual(["file"]);
        expect(pickableAttachments(permitted("text", "audio"))).toEqual([]);
    });
});

describe("the builders the entry offers", () => {
    const permitted = (...ps: MessagePermission[]) => new Set<MessagePermission>(ps);

    const none = new Set<ComposerBuilder>();

    test("each where the chat lets the reader send what it makes", () => {
        expect(composerBuilders(permitted("text", "poll"), none)).toEqual(["poll"]);
        expect(composerBuilders(permitted("text", "crypto"), none)).toEqual(["crypto"]);
        expect(composerBuilders(permitted("text"), none)).toEqual([]);
        // the + menu's order: the design's
        expect(
            composerBuilders(permitted("memeFighter", "crypto", "p2pSwap", "prize", "poll"), none),
        ).toEqual(["poll", "prize", "crypto", "swap", "memeFighter"]);
    });

    test("none this build turns off (the app store builds' payments)", () => {
        const all = permitted("poll", "prize", "crypto");
        expect(composerBuilders(all, new Set<ComposerBuilder>(["crypto", "prize"]))).toEqual([
            "poll",
        ]);
    });
});

describe("looking for members to mention", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("waits for two characters and a pause in typing", () => {
        const find = vi.fn();
        const finder = new MemberFinder(find);
        finder.typed("a");
        vi.advanceTimersByTime(FIND_MEMBERS_DELAY_MS);
        expect(find).not.toHaveBeenCalled();

        finder.typed("al");
        finder.typed("ali");
        vi.advanceTimersByTime(FIND_MEMBERS_DELAY_MS);
        expect(find.mock.calls).toEqual([["ali"]]);
    });

    test("forgets what was typed once the @word is gone, or it's cancelled", () => {
        const find = vi.fn();
        const finder = new MemberFinder(find);
        finder.typed("alice");
        finder.typed(undefined);
        finder.typed("bob");
        finder.cancel();
        vi.advanceTimersByTime(FIND_MEMBERS_DELAY_MS);
        expect(find).not.toHaveBeenCalled();
    });
});

describe("attaching a file now", () => {
    test("is possible while writing a message", () => {
        expect(canAttachNow({ editing: false, voiceActive: false })).toBe(true);
    });

    test("isn't during an edit, or while a voice message is recorded or reviewed", () => {
        expect(canAttachNow({ editing: true, voiceActive: false })).toBe(false);
        expect(canAttachNow({ editing: false, voiceActive: true })).toBe(false);
    });
});

describe("the draft's attachment", () => {
    const photo = { kind: "photo" };

    test("is staged and sent with the text", () => {
        expect(draftAttachment({ attachment: photo })).toBe(photo);
        expect(draftAttachment(undefined)).toBeUndefined();
    });

    test("is none during an edit, when the draft holds the edited message's content", () => {
        expect(draftAttachment({ attachment: photo, editingEvent: {} })).toBeUndefined();
    });
});

describe("what a send takes from the draft", () => {
    const photo = { kind: "photo" };

    test("an attachment the composer shows", () => {
        expect(attachmentToSend(photo, true)).toEqual({ kind: "send", attachment: photo });
        expect(attachmentToSend(undefined, false)).toEqual({ kind: "send", attachment: undefined });
    });

    test("not one it doesn't show", () => {
        expect(attachmentToSend({ kind: "puzzle" }, false)).toEqual({
            kind: "send",
            attachment: undefined,
        });
    });

    test("never the text without a payment it can't show (its token gone from the registry)", () => {
        for (const kind of ["crypto_content", "prize_content_initial", "p2p_swap_content_initial"]) {
            expect(attachmentToSend({ kind }, false)).toEqual({ kind: "payment_not_shown" });
        }
    });
});

describe("recording a voice message", () => {
    const can = {
        audioPermitted: true,
        recorderMimeType: "audio/mp4",
        micDenied: false,
        directBot: false,
    };

    test("is offered where audio may be sent and the browser can record", () => {
        expect(canRecordVoice(can)).toBe(true);
    });

    test("isn't where audio can't be sent, the browser can't record, the mic was turned down, or to a bot", () => {
        expect(canRecordVoice({ ...can, audioPermitted: false })).toBe(false);
        expect(canRecordVoice({ ...can, recorderMimeType: undefined })).toBe(false);
        expect(canRecordVoice({ ...can, micDenied: true })).toBe(false);
        expect(canRecordVoice({ ...can, directBot: true })).toBe(false);
    });
});

describe("what the entry says above the text", () => {
    test("is the throttle countdown first, then a video being prepared", () => {
        expect(entryNotice({ throttledSeconds: 12, videoProgress: 0.5 })).toEqual({
            kind: "throttled",
            seconds: 12,
        });
        expect(entryNotice({ throttledSeconds: undefined, videoProgress: 0.456 })).toEqual({
            kind: "video_processing",
            percent: 46,
        });
        expect(entryNotice({ throttledSeconds: undefined, videoProgress: undefined })).toBe(
            undefined,
        );
    });
});

describe("sending what the composer holds", () => {
    const chat = { kind: "group_chat", id: { kind: "group_chat", groupId: "g1" } } as ChatSummary;
    const thread: MessageContext = { chatId: chat.id, threadRootMessageIndex: 4 };

    function client(outcome: SendMessageOutcome = { kind: "posted" }, bot?: string) {
        return {
            directChatWithBot: vi.fn(() => bot),
            sendDirectBotMessage: vi.fn((): DirectBotMessageOutcome => ({ kind: "sent" })),
            sendMessage: vi.fn(async () => outcome),
        };
    }
    const none = { content: undefined, shown: false };

    test("4c invariant 1: a thread's composer posts to the thread, never the chat", async () => {
        const c = client();
        expect(await sendComposed(c, chat, thread, "hi", none)).toEqual({ kind: "posted" });
        expect(c.sendMessage).toHaveBeenCalledWith(thread, "hi", false, undefined);
    });

    test("is refused, keeping the draft, when the client doesn't post it", async () => {
        const c = client({ kind: "throttled" });
        expect(await sendComposed(c, chat, { chatId: chat.id }, "hi", none)).toEqual({
            kind: "refused",
            reason: "throttled",
        });
    });

    test("is declined, keeping the draft quietly, when the rules or the PIN are turned down", async () => {
        for (const kind of ["rules_declined", "pin_cancelled"] as const) {
            expect(await sendComposed(client({ kind }), chat, { chatId: chat.id }, "hi", none)).toEqual(
                { kind: "declined" },
            );
        }
    });

    test("tells the library's composer: nothing once posted, false when declined, a throw when refused", () => {
        expect(composerAnswer({ kind: "posted" })).toBeUndefined();
        expect(composerAnswer({ kind: "declined" })).toBe(false);
        expect(() => composerAnswer({ kind: "refused", reason: "throttled" })).toThrow("throttled");
    });

    test("captions the attachment shown, with no text for an empty caption", async () => {
        const c = client();
        const file = { kind: "file_content" } as AttachmentContent;
        await sendComposed(c, chat, { chatId: chat.id }, "", { content: file, shown: true });
        expect(c.sendMessage).toHaveBeenCalledWith({ chatId: chat.id }, undefined, false, file);
    });

    test("sends nothing for a payment the composer doesn't show", async () => {
        const c = client();
        const prize = { kind: "prize_content_initial" } as AttachmentContent;
        const sent = await sendComposed(c, chat, { chatId: chat.id }, "x", {
            content: prize,
            shown: false,
        });
        expect(sent).toEqual({ kind: "refused", reason: "payment_not_shown" });
        expect(c.sendMessage).not.toHaveBeenCalled();
    });

    test("in a direct chat with a bot, sends the bot its command, but not from a thread", async () => {
        const c = client({ kind: "posted" }, "bot1");
        await sendComposed(c, chat, { chatId: chat.id }, "/go", none);
        expect(c.sendDirectBotMessage).toHaveBeenCalledWith({ chatId: chat.id }, "/go", false);
        await sendComposed(c, chat, thread, "/go", none);
        expect(c.sendMessage).toHaveBeenCalledWith(thread, "/go", false, undefined);
    });
});

describe("the entry's placeholder", () => {
    const placeholder = (canEnterText: boolean, attached: boolean, directBot: boolean) =>
        entryPlaceholder({ canEnterText, attached, directBot }).key;

    test("says what can be written there", () => {
        expect(placeholder(false, true, true)).toBe("sendTextDisabled");
        expect(placeholder(true, true, true)).toBe("enterCaption");
        expect(placeholder(true, false, true)).toBe("bots.direct.placeholder");
        expect(placeholder(true, false, false)).toBe("enterMessage");
    });
});

describe("where the entry is", () => {
    const group = {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: "g1" },
        frozen: false,
    } as ChatSummary;
    const dm = {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId: "them" },
        them: { userId: "them" },
    } as ChatSummary;
    const reader = {
        suspended: false,
        anonymous: false,
        blockedUsers: new Set<string>(),
        community: undefined,
        recipient: undefined,
        permitted: new Set<MessagePermission>(["text"]),
    };

    function client(previewing = false) {
        return {
            isChatOrCommunityFrozen: vi.fn(() => false),
            isPreviewing: vi.fn(() => previewing),
            isLapsed: vi.fn(() => previewing),
        };
    }

    test("can send where text is permitted", () => {
        expect(chatEntryState(client(), group, false, reader).canSend).toBe(true);
        const none = { ...reader, permitted: new Set<MessagePermission>() };
        expect(chatEntryState(client(), dm, false, none).canSend).toBe(false);
        expect(entryBlock(chatEntryState(client(), dm, false, none))).toEqual({
            kind: "read_only",
            key: "readOnlyChat",
        });
    });

    test("a preview or a lapse is the chat's, never a thread's", () => {
        expect(chatEntryState(client(true), group, false, reader)).toMatchObject({
            previewing: true,
            lapsed: true,
        });
        expect(chatEntryState(client(true), group, true, reader)).toMatchObject({
            previewing: false,
            lapsed: false,
            thread: true,
        });
    });

    test("a DM with someone the reader blocked is blocked", () => {
        const blocked = { ...reader, blockedUsers: new Set(["them"]) };
        expect(chatEntryState(client(), dm, false, blocked)).toMatchObject({
            blocked: true,
            direct: true,
            previewing: false,
        });
        expect(chatEntryState(client(), group, false, blocked).blocked).toBe(false);
    });

    test("a DM's other user suspended is its own block, lifted on un-suspending", () => {
        const them = { userId: "them", kind: "user", suspended: true } as const;
        const suspended = { ...reader, recipient: them, permitted: new Set<MessagePermission>() };
        expect(entryBlock(chatEntryState(client(), dm, false, suspended))).toEqual({
            kind: "recipient_suspended",
        });
        const back = { ...reader, recipient: { ...them, suspended: false } };
        expect(entryBlock(chatEntryState(client(), dm, false, back))).toBeUndefined();
        // someone else's (the selected DM's changing under it), or a group's, is never it
        const other = { ...suspended, recipient: { ...them, userId: "other" } };
        expect(chatEntryState(client(), dm, false, other).recipientSuspended).toBe(false);
        expect(chatEntryState(client(), group, false, suspended).recipientSuspended).toBe(false);
    });

    test("a frozen chat, or a channel of a frozen community, is frozen, not read only", () => {
        const frozen = {
            isChatOrCommunityFrozen: vi.fn(() => true),
            isPreviewing: vi.fn(() => false),
            isLapsed: vi.fn(() => false),
        };
        const none = { ...reader, permitted: new Set<MessagePermission>() };
        expect(entryBlock(chatEntryState(frozen, group, false, none))).toEqual({ kind: "frozen" });
    });
});

describe("what stands in for the entry", () => {
    test("is the old footer's words, a warning where the chat can't be used", () => {
        expect(entryBlockBanner({ kind: "suspended" })).toEqual({
            key: "accountSuspended",
            tone: "warning",
        });
        expect(entryBlockBanner({ kind: "blocked" })).toEqual({
            key: "userIsBlocked",
            tone: "info",
        });
        expect(entryBlockBanner({ kind: "frozen" })).toEqual({
            key: "chatFrozen",
            tone: "warning",
        });
        expect(entryBlockBanner({ kind: "recipient_suspended" })).toEqual({
            key: "recipientSuspended",
            tone: "warning",
        });
        expect(entryBlockBanner({ kind: "preview", lapsed: true }).key).toBe(
            "access.lapsed.label",
        );
        expect(entryBlockBanner({ kind: "read_only", key: "readOnlyThread" })).toEqual({
            key: "readOnlyThread",
            tone: "info",
        });
    });

    test("offers a guest to sign in, and nobody else", () => {
        expect(entryBlockBanner({ kind: "anonymous" })).toEqual({
            key: "sendMessageDisabledAnon",
            tone: "info",
            signIn: true,
        });
        expect(entryBlockBanner({ kind: "read_only", key: "readOnlyChat" }).signIn).toBeUndefined();
        expect(entryBlockBanner({ kind: "read_only", key: "readOnlyThread" }).signIn).toBeUndefined();
        expect(entryBlockBanner({ kind: "suspended" }).signIn).toBeUndefined();
    });
});

describe("the entry's notice in words", () => {
    test("is the throttle's countdown as a warning, a video's progress as information", () => {
        expect(entryNoticeText({ kind: "throttled", seconds: 9 })).toMatchObject({
            key: { key: "throttleMessage", params: { time: 9 } },
            tone: "warning",
        });
        expect(entryNoticeText({ kind: "video_processing", percent: 40 })).toMatchObject({
            key: { key: "videoProcessingPercent", params: { percent: 40 } },
            tone: "info",
        });
    });
});

describe("who the entry offers to mention", () => {
    const user = (userId: string, username: string): UserSummary =>
        ({ kind: "user", userId, username, displayName: undefined }) as UserSummary;
    const lookup: Record<string, UserOrUserGroup> = {
        me: user("me", "alice"),
        a: user("a", "alfie"),
        b: user("b", "bob"),
        everyone: { kind: "everyone" },
    };
    const client = { getUserLookupForMentions: () => lookup };
    const ids = (found: UserOrUserGroup[]) =>
        found.map((m) => (m.kind === "user" ? m.userId : m.kind));

    test("is the chat's members matching the word, never the reader, @everyone first", () => {
        expect(ids(mentionsFor(client, "al", "me"))).toEqual(["a"]);
        const all = ids(mentionsFor(client, "", "me"));
        expect(all[0]).toBe("everyone");
        expect([...all].sort()).toEqual(["a", "b", "everyone"]);
    });
});

describe("sending a voice message", () => {
    const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g1" } };
    // jsdom's Blob has no arrayBuffer()
    const recording = { arrayBuffer: async () => new ArrayBuffer(3) } as Blob;

    function client(outcome: SendMessageOutcome) {
        return {
            sendVoiceMessage: vi.fn(
                async (_ctx: MessageContext, _data: ArrayBuffer, _mime: string) => outcome,
            ),
        };
    }

    test("sends the recording's audio to the chat or thread", async () => {
        const c = client({ kind: "posted" });
        expect(await sendVoiceRecording(c, context, recording, "audio/mp4")).toEqual({
            kind: "posted",
        });
        const [to, data, mime] = c.sendVoiceMessage.mock.calls[0];
        expect(to).toBe(context);
        expect(data.byteLength).toBe(3);
        expect(mime).toBe("audio/mp4");
    });

    test("is declined, keeping the take quietly, when the rules are turned down", async () => {
        expect(
            await sendVoiceRecording(client({ kind: "rules_declined" }), context, recording, "a"),
        ).toEqual({ kind: "declined" });
    });

    test("is refused, keeping the take, when it isn't posted", async () => {
        expect(
            await sendVoiceRecording(client({ kind: "throttled" }), context, recording, "a"),
        ).toEqual({ kind: "refused", reason: "throttled" });
    });
});
