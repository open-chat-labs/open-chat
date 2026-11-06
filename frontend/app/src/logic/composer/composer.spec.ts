import {
    FIND_MEMBERS_DELAY_MS,
    ScreenWidth,
    type MessagePermission,
    type UserGroupDetails,
    type UserSummary,
} from "@client";
import {
    attachRefusal,
    canAttachNow,
    canRecordVoice,
    composerBuilders,
    attachmentToSend,
    draftAttachment,
    editStartText,
    entryBlock,
    entryNotice,
    entryPlaceholder,
    focusEntryOnOpen,
    MemberFinder,
    pickableAttachments,
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

    test("signed out, or not allowed, is read only, a thread's in a thread", () => {
        expect(entryBlock({ ...can, anonymous: true, canSend: false })).toEqual({
            kind: "read_only",
            key: "sendMessageDisabledAnon",
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

    test("is a captioned message's caption, and nothing for what has no text", () => {
        const image = {
            kind: "image_content",
            height: 1,
            width: 1,
            thumbnailData: "",
            mimeType: "image/png",
        } as const;
        expect(editStartText({ ...image, caption: "nice" }, users, groups)).toBe("nice");
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
