import {
    externalWalletPayment,
    FIND_MEMBERS_DELAY_MS,
    isCaptionedContent,
    MAX_MENTION_CANDIDATES_SHOWN,
    mentionCandidates,
    mentionsAsTyped,
    ScreenWidth,
    stripLinkDisabledMarker,
    type AttachFileOutcome,
    type AttachmentContent,
    type ChatSummary,
    type CommunitySummary,
    type DirectChatRecipient,
    type MessageContent,
    type MessageContext,
    type MessageFormatter,
    type MessagePermission,
    type OpenChat,
    type ResourceKey,
    type SendMessageOutcome,
    type UserGroupDetails,
    type UserLookup,
    type UserOrUserGroup,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { detectMarkdown } from "@src/utils/detectMarkdown";

// The message entry's decisions, shared by every tree: why a message can't be sent, when the
// others hear someone is typing, and when it takes focus, what it starts an edit from, what it
// says about a file it couldn't attach. (What a typed message is sent as, its mentions expanded,
// is up to the client's send.)

/** What the message entry knows about where it is. */
export type EntryState = {
    /** The reader's account is suspended (the old UI hid the composer). */
    suspended: boolean;
    /** The chat, or its community, is frozen. */
    frozen: boolean;
    /** A DM with someone the reader has blocked. */
    blocked: boolean;
    /** A DM whose other user's account is suspended (by a platform moderator). */
    recipientSuspended: boolean;
    /** Not a member of the group or channel (a preview), or a lapsed one. */
    previewing: boolean;
    lapsed: boolean;
    /** A direct chat (never a preview). */
    direct: boolean;
    /** A channel showing external content, which can't be posted to. */
    externalContent: boolean;
    /** Signed out. */
    anonymous: boolean;
    /** The reader's role lets them send here. */
    canSend: boolean;
    /** The entry is a thread's. */
    thread: boolean;
};

/** What stands in place of the message entry, when the reader can't send. */
export type EntryBlock =
    | { kind: "suspended" }
    | { kind: "frozen" }
    // a DM's other user is suspended: nothing can be sent to them
    | { kind: "recipient_suspended" }
    | { kind: "blocked" }
    // the preview's Join (or, lapsed, re-join) footer
    | { kind: "preview"; lapsed: boolean }
    | { kind: "external" }
    // signed out: the old footers' "Please sign-in to send a message", with a Sign in action
    | { kind: "anonymous" }
    | { kind: "read_only"; key: "readOnlyThread" | "readOnlyChat" };

/**
 * Why the reader can't send here, in the order the old footers checked; none when they can. Every
 * tree's entry shows this, each in its own way. A platform moderator's doing comes first, as the
 * reader can't undo it: their own suspension (it holds everywhere), then the chat frozen (a group's
 * or channel's), then a DM's other user suspended (unblocking them wouldn't help), and only then
 * what the reader can change (whom they've blocked, joining).
 */
export function entryBlock(state: EntryState): EntryBlock | undefined {
    if (state.suspended) return { kind: "suspended" };
    if (state.frozen) return { kind: "frozen" };
    if (state.recipientSuspended) return { kind: "recipient_suspended" };
    if (state.blocked) return { kind: "blocked" };
    if ((state.previewing || state.lapsed) && !state.direct) {
        return { kind: "preview", lapsed: state.lapsed };
    }
    if (state.externalContent) return { kind: "external" };
    if (state.anonymous) return { kind: "anonymous" };
    if (!state.canSend) {
        return { kind: "read_only", key: state.thread ? "readOnlyThread" : "readOnlyChat" };
    }
    return undefined;
}

/**
 * Where the entry is, for `entryBlock`: the chat's own state (frozen, previewed, lapsed) from the
 * client, the reader's (suspended, signed out, who they've blocked, what they may send) from the
 * stores. In a thread (`thread`), a preview and a lapse are the chat's, not the thread's, and what
 * may be sent is the thread's.
 */
export function chatEntryState(
    client: Pick<OpenChat, "isChatOrCommunityFrozen" | "isPreviewing" | "isLapsed">,
    chat: ChatSummary,
    thread: boolean,
    reader: {
        suspended: boolean;
        anonymous: boolean;
        blockedUsers: Pick<ReadonlySet<string>, "has">;
        /** The chat's community (the selected one), for whether it's frozen. */
        community: CommunitySummary | undefined;
        /**
         * A DM's other user (`selectedChatRecipientStore`), for whether they're suspended; it
         * publishes when that changes, so the entry follows a moderator (un)suspending them.
         */
        recipient: DirectChatRecipient | undefined;
        /**
         * What may be sent here: the selected chat's message permissions, or its thread's
         * (`messagePermissionsForSelectedChatStore`, `threadPermissionsForSelectedChatStore`).
         * The store, not the client's `canSendMessage`, so the entry follows a DM's other user
         * being suspended or un-suspended.
         */
        permitted: Pick<ReadonlySet<MessagePermission>, "has">;
    },
): EntryState {
    return {
        suspended: reader.suspended,
        frozen: client.isChatOrCommunityFrozen(chat, reader.community),
        blocked: chat.kind === "direct_chat" && reader.blockedUsers.has(chat.them.userId),
        recipientSuspended:
            chat.kind === "direct_chat" &&
            reader.recipient?.userId === chat.them.userId &&
            reader.recipient.suspended,
        previewing: !thread && chat.kind !== "direct_chat" && client.isPreviewing(chat.id),
        lapsed: !thread && client.isLapsed(chat.id),
        direct: chat.kind === "direct_chat",
        externalContent: chat.kind === "channel" && chat.externalUrl !== undefined,
        anonymous: reader.anonymous,
        canSend: reader.permitted.has("text"),
        thread,
    };
}

/**
 * What stands in for the entry where the reader can't send, in the old footers' words: a banner's
 * text (a resource key) and tone. A preview's shows only while its bar (Join) isn't known. A
 * guest's offers to sign in (`signIn`): the composer's Sign in prompt.
 */
export function entryBlockBanner(block: EntryBlock): {
    key: string;
    tone: "info" | "warning";
    signIn?: true;
} {
    switch (block.kind) {
        case "suspended":
            return { key: "accountSuspended", tone: "warning" };
        case "frozen":
            return { key: "chatFrozen", tone: "warning" };
        // TODO(design): no words for it in the design or the old trees (they said read-only)
        case "recipient_suspended":
            return { key: "recipientSuspended", tone: "warning" };
        case "blocked":
            return { key: "userIsBlocked", tone: "info" };
        case "preview":
            return { key: block.lapsed ? "access.lapsed.label" : "readOnlyChat", tone: "info" };
        case "external":
            return { key: "externalContent.disclaimer", tone: "warning" };
        case "anonymous":
            return { key: "sendMessageDisabledAnon", tone: "info", signIn: true };
        case "read_only":
            return { key: block.key, tone: "info" };
    }
}

// as the old composer: say "typing" at most once a second, and "stopped" after 5s without input
const START_INTERVAL_MS = 1000;
const STOP_AFTER_MS = 5000;

/** Tells the others someone is typing while they write, and when they've stopped. */
export class TypingNotifier {
    #lastStart = 0;
    #typing = false;
    #stopTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly start: () => void,
        private readonly stop: () => void,
        private readonly now: () => number = Date.now,
    ) {}

    /** The draft changed: typing, or (emptied) stopped. */
    input(text: string): void {
        if (text.trim() === "") {
            this.stopped();
            return;
        }
        const now = this.now();
        if (!this.#typing || now - this.#lastStart > START_INTERVAL_MS) {
            this.#lastStart = now;
            this.#typing = true;
            this.start();
        }
        clearTimeout(this.#stopTimer);
        this.#stopTimer = setTimeout(() => this.stopped(), STOP_AFTER_MS);
    }

    /** Left: forgotten, without telling the others (they're another chat's by now; their own
     * "typing" runs out by itself). */
    cancel(): void {
        clearTimeout(this.#stopTimer);
        this.#stopTimer = undefined;
        this.#typing = false;
    }

    /** Sent, or emptied: stopped, if they were typing. */
    stopped(): void {
        clearTimeout(this.#stopTimer);
        this.#stopTimer = undefined;
        if (this.#typing) {
            this.#typing = false;
            this.stop();
        }
    }
}

/**
 * Too many messages a minute: whole seconds until sending resumes (rounded up, so it never reads
 * 0s while sends are still refused) and how much of the minute is left, or undefined once the
 * deadline has passed (or there is none).
 */
export function throttleCountdown(
    deadline: number,
    now: number,
): { seconds: number; percent: number } | undefined {
    if (deadline <= now) return undefined;
    const seconds = Math.ceil((deadline - now) / 1000);
    return { seconds, percent: Math.floor((seconds / 60) * 100) };
}

/**
 * Whether the message entry takes focus when a chat or thread is opened: only on a wide screen
 * that isn't a touch-only device (a tablet runs the wide layout too), since focusing would
 * otherwise bring up the on-screen keyboard over the messages.
 */
export function focusEntryOnOpen(width: ScreenWidth, touchOnly: boolean): boolean {
    if (touchOnly) return false;
    switch (width) {
        case ScreenWidth.Large:
        case ScreenWidth.ExtraLarge:
        case ScreenWidth.ExtraExtraLarge:
            return true;
        default:
            return false;
    }
}

/**
 * The text an edit starts from: a text message's text with each `@UserId(…)` and `@UserGroup(…)`
 * as the `@name` it was typed as (one not known stays as it is, and is mentioned again as it was
 * on saving: `mentionsAsTyped`) and the link-disabled marker taken out; a captioned message's
 * caption, its mentions as typed too. Nothing for a message whose text can't be edited.
 */
export function editStartText(
    content: MessageContent,
    users: UserLookup,
    userGroups: Pick<ReadonlyMap<number, UserGroupDetails>, "get">,
): string | undefined {
    const typed = (text: string) =>
        mentionsAsTyped(
            text,
            (userId) => users.get(userId)?.username,
            (id) => userGroups.get(id)?.name,
        );
    if (content.kind === "text_content") return typed(stripLinkDisabledMarker(content.text));
    if (isCaptionedContent(content)) return typed(content.caption ?? "");
    return undefined;
}

/** What to tell the user about a file that wasn't attached. */
export function attachRefusal(
    outcome: Exclude<AttachFileOutcome, { kind: "attached" }>,
    formatter: MessageFormatter,
): ResourceKey {
    switch (outcome.kind) {
        case "not_permitted":
            return i18nKey("permissions.notPermitted", {
                permission: formatter(`permissions.threadPermissions.${outcome.permission}`),
            });
        case "failed":
            return outcome.message;
    }
}

/**
 * What the entry offers to pick from the device: photos and videos where either may be sent, any
 * file where files may be (one a message: the content holds one). An audio file is a file to
 * pick, refused if audio can't be sent.
 */
export function pickableAttachments(
    permitted: ReadonlySet<MessagePermission>,
): ("media" | "file")[] {
    const kinds: ("media" | "file")[] = [];
    if (permitted.has("image") || permitted.has("video")) kinds.push("media");
    if (permitted.has("file")) kinds.push("file");
    return kinds;
}

/** What the entry's builders make: a poll, a prize, a transfer, a swap offer, a Meme Fighter meme. */
export type ComposerBuilder = "poll" | "prize" | "crypto" | "swap" | "memeFighter";

/**
 * The builders the entry offers, each where the chat lets the reader send what it makes (polls
 * aren't sent in a DM, nor tokens to a bot) and this build doesn't turn it off (`off`: the app
 * store builds take payments out, `utils/features`).
 */
export function composerBuilders(
    permitted: ReadonlySet<MessagePermission>,
    off: ReadonlySet<ComposerBuilder>,
): ComposerBuilder[] {
    const builders: [ComposerBuilder, MessagePermission][] = [
        ["poll", "poll"],
        ["prize", "prize"],
        ["crypto", "crypto"],
        ["swap", "p2pSwap"],
        ["memeFighter", "memeFighter"],
    ];
    return builders.flatMap(([builder, permission]) =>
        permitted.has(permission) && !off.has(builder) ? [builder] : [],
    );
}

// as the old pickers: what's typed after the "@" is looked for once it's this long
const FIND_MEMBERS_FROM = 2;

/**
 * Looks for the members a chat doesn't hold that match what's typed after an "@" (a big group
 * holds only some of its members), once it's two characters long and typing has paused
 * (`FIND_MEMBERS_DELAY_MS`). Every mention picker uses it.
 */
export class MemberFinder {
    #timer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly find: (prefix: string) => void) {}

    /** What's typed after the "@" changed; none once there's no "@word". */
    typed(prefix: string | undefined): void {
        this.cancel();
        if (prefix === undefined || prefix.length < FIND_MEMBERS_FROM) return;
        this.#timer = setTimeout(() => this.find(prefix), FIND_MEMBERS_DELAY_MS);
    }

    cancel(): void {
        clearTimeout(this.#timer);
        this.#timer = undefined;
    }
}

/**
 * Who the entry offers to mention for the "@word" being typed (`query`, without the "@"): those
 * the chat can mention (its members as the client holds them, its user groups and @everyone),
 * never the reader, @everyone first, as many as a list shows. Every mention picker uses it.
 */
export function mentionsFor(
    client: Pick<OpenChat, "getUserLookupForMentions">,
    query: string,
    me: string,
): UserOrUserGroup[] {
    return mentionCandidates(Object.values(client.getUserLookupForMentions()), query, {
        me,
        mentionSelf: false,
        supportsUserGroups: true,
        usersOnly: false,
        keepUserOrder: false,
    }).slice(0, MAX_MENTION_CANDIDATES_SHOWN);
}

/**
 * Whether the entry offers to record a voice message (as the old entries' mic): where audio may
 * be sent, the browser can record in a format every device plays, the user hasn't turned the
 * microphone down, and not to a bot (which takes text). The entry itself hides it while there's
 * text, an attachment or an edit.
 */
export function canRecordVoice(state: {
    audioPermitted: boolean;
    /** What the browser records in (`audioRecordingMimeType`), if anything. */
    recorderMimeType: string | undefined;
    micDenied: boolean;
    directBot: boolean;
}): boolean {
    return (
        state.audioPermitted &&
        state.recorderMimeType !== undefined &&
        !state.micDenied &&
        !state.directBot
    );
}

/**
 * Whether a file picked, pasted or dropped can be attached now. Not during an edit, which changes
 * only the message's text (the old entries hid their pickers): a file attached then would take the
 * edited message's place in the draft, be ignored by the edit, and be gone once the draft goes
 * back to what it was before. Nor while a voice message is being recorded or reviewed: sending it
 * posts the draft, so a file staged meanwhile would go with it, unseen.
 */
export function canAttachNow(state: { editing: boolean; voiceActive: boolean }): boolean {
    return !state.editing && !state.voiceActive;
}

/**
 * The draft's attachment, to stage and send with its text: none during an edit, when the draft
 * holds the edited message's own content (`setEditing`), which isn't something being attached.
 */
export function draftAttachment<A>(
    draft: { attachment?: A; editingEvent?: unknown } | undefined,
): A | undefined {
    return draft?.editingEvent === undefined ? draft?.attachment : undefined;
}

/**
 * What a send takes from the draft's attachment (`draftAttachment`), given whether the composer
 * shows it: an attachment shown goes with the text; one it doesn't show isn't sent (a puzzle
 * result, not yet), except a payment (a transfer, a prize, a swap offer), which can go unshown
 * when its token has left the registry: the send is refused rather than the text going without
 * it, and the draft that holds it with it.
 */
export function attachmentToSend<A extends { kind: string }>(
    attachment: A | undefined,
    shown: boolean,
): { kind: "send"; attachment: A | undefined } | { kind: "payment_not_shown" } {
    if (attachment === undefined || shown) return { kind: "send", attachment };
    switch (attachment.kind) {
        case "crypto_content":
        case "prize_content_initial":
        case "p2p_swap_content_initial":
            return { kind: "payment_not_shown" };
        default:
            return { kind: "send", attachment: undefined };
    }
}

/** What the entry says above the text: one thing at a time, the most pressing first. */
export type EntryNotice =
    // too many messages a minute: sending resumes in this many seconds
    | { kind: "throttled"; seconds: number }
    // a video picked here being made smaller to send
    | { kind: "video_processing"; percent: number };

export function entryNotice(state: {
    throttledSeconds: number | undefined;
    /** How far a video picked here is through being prepared (0–1). */
    videoProgress: number | undefined;
}): EntryNotice | undefined {
    if (state.throttledSeconds !== undefined) {
        return { kind: "throttled", seconds: state.throttledSeconds };
    }
    if (state.videoProgress !== undefined) {
        return { kind: "video_processing", percent: Math.round(state.videoProgress * 100) };
    }
    return undefined;
}

/** The entry's notice in words, with its tone: a warning for the throttle. */
export function entryNoticeText(notice: EntryNotice): {
    key: ResourceKey;
    tone: "info" | "warning";
} {
    switch (notice.kind) {
        case "throttled":
            return { key: i18nKey("throttleMessage", { time: notice.seconds }), tone: "warning" };
        case "video_processing":
            return {
                key: i18nKey("videoProcessingPercent", { percent: notice.percent }),
                tone: "info",
            };
    }
}

/** The entry's placeholder: what the user can write there. */
export function entryPlaceholder(state: {
    /** Text can be sent here, or there's an attachment or an edit to write a caption or text for. */
    canEnterText: boolean;
    attached: boolean;
    /** A direct chat with a bot: what's typed goes to the bot. */
    directBot: boolean;
}): ResourceKey {
    if (!state.canEnterText) return i18nKey("sendTextDisabled");
    if (state.attached) return i18nKey("enterCaption");
    if (state.directBot) return i18nKey("bots.direct.placeholder");
    return i18nKey("enterMessage");
}

/**
 * What became of a send from the composer: posted (it shows in the chat or thread); declined, the
 * user having turned down the prompt it waited on (the chat's rules to accept, the PIN), when the
 * composer keeps the draft and says nothing; or refused before it was (`reason` says why, for the
 * log), when the composer keeps the draft and says it couldn't send.
 */
export type ComposedSend =
    | { kind: "posted" }
    | { kind: "declined" }
    | { kind: "refused"; reason: string };

function composedSend(outcome: SendMessageOutcome): ComposedSend {
    switch (outcome.kind) {
        case "posted":
            return { kind: "posted" };
        case "rules_declined":
        case "pin_cancelled":
            return { kind: "declined" };
        default:
            return { kind: "refused", reason: outcome.kind };
    }
}

/**
 * What the library's composer is told of a send (its `onSend` / `onVoice`): nothing once it's
 * posted, `false` when the user declined (the draft stays, with no error), and a refusal throws
 * (the draft stays, and the composer says it couldn't send).
 */
export function composerAnswer(sent: ComposedSend): false | undefined {
    if (sent.kind === "refused") throw new Error(sent.reason);
    return sent.kind === "declined" ? false : undefined;
}

/**
 * Sends what the composer holds to the chat or thread it's in (`context`): the text, with the
 * draft's attachment it captions, as the client's send does it (mentions typed as @username, block
 * markdown detected). In a direct chat with a bot the text goes to the bot as its direct-message
 * command. Refused, nothing is sent: a payment the composer doesn't show, or one an external
 * wallet would have to approve first (the web tree's builders pay from the OpenChat wallet only),
 * which would otherwise be taken from the OpenChat wallet.
 */
export async function sendComposed(
    client: Pick<OpenChat, "directChatWithBot" | "sendDirectBotMessage" | "sendMessage">,
    chat: ChatSummary,
    context: MessageContext,
    text: string,
    attachment: { content: AttachmentContent | undefined; shown: boolean },
): Promise<ComposedSend> {
    const markdown = detectMarkdown(text);
    if (
        context.threadRootMessageIndex === undefined &&
        client.directChatWithBot(chat) !== undefined
    ) {
        const outcome = client.sendDirectBotMessage(context, text, markdown);
        return outcome.kind === "sent"
            ? { kind: "posted" }
            : { kind: "refused", reason: outcome.kind };
    }
    const taken = attachmentToSend(attachment.content, attachment.shown);
    if (taken.kind === "payment_not_shown") return { kind: "refused", reason: taken.kind };
    if (externalWalletPayment(taken.attachment) !== undefined) {
        return { kind: "refused", reason: "external_wallet" };
    }
    const outcome = await client.sendMessage(
        context,
        text === "" ? undefined : text,
        markdown,
        taken.attachment,
    );
    return composedSend(outcome);
}

/**
 * Sends a voice message recorded in the entry to the chat or thread it's in (`context`), as a
 * reply to the draft's reply, if any. Refused, nothing is sent, and the take stays to send again.
 */
export async function sendVoiceRecording(
    client: Pick<OpenChat, "sendVoiceMessage">,
    context: MessageContext,
    recording: Blob,
    mimeType: string,
): Promise<ComposedSend> {
    const outcome = await client.sendVoiceMessage(context, await recording.arrayBuffer(), mimeType);
    return composedSend(outcome);
}
