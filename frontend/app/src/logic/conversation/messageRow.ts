import {
    OPENCHAT_BOT_USER_ID,
    allowsVoteChange,
    formatClock,
    formatFileSize,
    formatTokens,
    getConvertedBalances,
    i18nKey,
    isCriticalProposal,
    isDeletedWebhook,
    neuronLabel,
    ogPreviewCard,
    ownUserAvatarUrl,
    pollView,
    prizeView,
    referralLink,
    proposalOutcome,
    proposalTopicLabel,
    proposalVotePercent,
    proposalVoteStatus,
    swapActions,
    swapLabels,
    toLongDatetimeString,
    twitchLiveThumbnailUrl,
    twitchPlayerUrl,
    twitchPoster,
    twitchWatchUrl,
    votesForAnswer,
    waveformLevels,
    type ChatSummary,
    type CryptocurrencyContent,
    type CryptocurrencyDetails,
    type DeletedContent,
    type EventWrapper,
    type GiphyContent,
    type ImageContent,
    type MemeFighterContent,
    type Message,
    type MessageContent,
    type MessageFormatter,
    type OgPreview,
    type OpenChat,
    type P2PSwapContent,
    type P2PSwapContentInitial,
    type PollContent,
    type PrizeContent,
    type PrizeContentInitial,
    type PrizeReader,
    type PrizeWinnerContent,
    type ProposalContent,
    type ProposalVoteStatus,
    type ReadonlyMap,
    type ResourceKey,
    type TokenExchangeRates,
    type TipsReceived,
    type TokenInfo,
    type TwitchPlayerPreview,
    type UserLookup,
    type VideoContent,
    type WebhookDetails,
} from "@client";
import { interpolateNewUi } from "@i18n/i18n";
import type { GroupMessage } from "@openchat/ui/src/lib/types";
import { formatConvertedValue } from "@src/logic/wallet/walletState.svelte";
import { getProxyAdjustedBlobUrl } from "@src/utils/media";
import { swatchFor, type Swatch } from "@src/logic/swatch";
import { findUser } from "@src/utils/user";
import { NamedNeurons } from "@src/stores/namedNeurons";
import { threadUnreadCount } from "@src/logic/threads/threadRead";
import { typedMentions, type MentionLookups } from "./typedMentions";
import { linkPreviews } from "./linkPreview";

// A conversation's messages to MessageGroup's messages, for every tree that shows them with the
// library (src/web's conversation, src/native's; src/web/DATA.md, Conversation). The timeline's
// other events are worded by logic/conversation/timelineEventText, as in the old trees. The
// client's lookups (names, text, dates) come in through ConversationContext (`conversationContext`
// makes it from the client and the stores' values), so the mapping stays pure.

export type SenderColor = Swatch;

/** A sender's swatch: the one their id has everywhere (`swatchFor`), their DM's row's too. */
export function senderColor(id: string): SenderColor {
    return swatchFor(id);
}

export type ConversationContext = {
    /** The signed-in user's id. */
    me: string;
    /** "You", in the app's language. */
    you: string;
    userName: (userId: string) => string;
    /** A message's content as text, in the app's language (for kinds not shown yet, and quotes). */
    contentText: (content: MessageContent) => string;
    /** A text shown as it is (a quote) with its mentions as the @names typed (`mentionsAsTyped`). */
    mentionsAsTyped: (text: string) => string;
    /** A message's time, as its bubble shows it. */
    time: (timestamp: bigint) => string;
    /** A date as the list shows it (a time today, else a short date). */
    date: (timestamp: bigint) => string;
    /** A date and time in full, as the old trees' deleted messages and event lines say it. */
    longDate: (timestamp: bigint | number) => string;
    /**
     * A day and time as the list's date pills name the day ("Today", "Yesterday", "Monday", else the
     * date) with the time: "Today at 14:32" (when a message was deleted).
     */
    dayAndTime: (timestamp: bigint) => string;
    /** How media shows: low bandwidth, and the media URL as this device fetches it. */
    media: MediaView;
    /** Whether the conversation is a DM. */
    direct: boolean;
    /** Whether the reader can only read it (suspended, previewing). */
    readonly: boolean;
    /** When the rows are made (ms), for how long a poll or prize has left. */
    now: number;
    /** What the reader holds that a prize's requirements ask about, and whether they're only previewing. */
    claimant: Omit<PrizeReader, "mine" | "direct" | "now">;
    /** A resource key in the app's language. */
    text: (key: ResourceKey) => string;
    /** A ledger's token as transfers show it; undefined for one the registry doesn't carry. */
    token: (ledger: string) => TransferToken | undefined;
    /** The root (message index) of the thread open beside the conversation (the route's); none in a thread. */
    openThread: number | undefined;
    /** A user's face as the conversation shows it (their avatar's colour, a CSS background). */
    face: (userId: string) => string;
    /**
     * A sender's own picture, over their colour: a user's avatar, a bot's or a system user's fixed
     * picture, a webhook's own (ownUserAvatarUrl). None without one: their colour alone, as a
     * person without a picture shows their swatch everywhere in the new web UI (2026-11-10).
     */
    avatar: (userId: string) => string | undefined;
    /**
     * A thread's unread replies, by its root's index: as the list of threads counts them
     * (`threadUnreadCount`), none for a thread the reader doesn't follow.
     */
    unreadInThread: (threadRootMessageIndex: number) => number;
    /** Whether the view shows threads: without, a message has no thread link (no thread fields). */
    threads: boolean;
    /** Whether a deleted message is being undeleted (`undeletingMessagesStore`). */
    undeleting: (messageId: bigint) => boolean;
    /** The reader's own referral link, which the OpenChat bot's referral card gives them. */
    referralLink: string;
    /**
     * Where a Twitch link's player can play (`twitchPlayerParent`: this site, not framed by
     * another, not the native apps); none, and the link shows as a row linking to Twitch.
     */
    twitchParent: string | undefined;
    /** A proposals chat's names for its proposals' types (NNS topics, SNS actions). */
    proposalTopics: ReadonlyMap<number, string>;
    /** The reader's vote on a proposal this session (`proposalVotesStore`), on its way or counted. */
    proposalVote: (messageId: bigint) => ProposalVoteStatus | undefined;
};

export type TransferToken = {
    symbol: string;
    logo: string;
    /** An amount (e8s) in whole tokens. */
    amount: (e8s: bigint) => string;
    /** An amount (e8s) in dollars, or empty without a rate. */
    usd: (e8s: bigint) => string;
};

export type MediaView = {
    lowBandwidth: boolean;
    /** Whether the reader asked to see this message's full-size media (low bandwidth). */
    revealed: (messageId: bigint) => boolean;
    url: (blobUrl: string | undefined) => string | undefined;
};

export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

/**
 * The old bubbles' ticks as the design's status: failed, still on its way (not yet accepted;
 * the old trees show a sent tick once it is, confirmed or not), read by the other person in a DM
 * ("delivered", the design's double tick), or sent.
 */
export function messageStatus(state: {
    failed: boolean;
    accepted: boolean;
    readByThem: boolean;
}): MessageStatus {
    if (state.failed) return "failed";
    if (!state.accepted) return "sending";
    return state.readByThem ? "delivered" : "sent";
}

export type MessageRow = {
    side: "sent" | "received";
    senderName: string;
    color: SenderColor;
    /** The sender's own picture (ConversationContext's `avatar`), over `color`. */
    avatarUrl?: string;
    message: GroupMessage;
};

type MediaKind = "image" | "video" | "gif";
export type MediaContent = ImageContent | VideoContent | GiphyContent | MemeFighterContent;

export function isMedia(content: MessageContent): content is MediaContent {
    return (
        content.kind === "image_content" ||
        content.kind === "video_content" ||
        content.kind === "giphy_content" ||
        content.kind === "meme_fighter_content"
    );
}

/**
 * Whether an image's or GIF's full size is held back (low bandwidth, not yet revealed): its tile
 * doesn't get the full-size URL, and a click reveals it rather than opening the viewer (5a
 * invariant 1). Memes and videos aren't held, as in the old trees.
 */
export function mediaHeld(content: MediaContent, messageId: bigint, media: MediaView): boolean {
    return (
        (content.kind === "image_content" || content.kind === "giphy_content") &&
        media.lowBandwidth &&
        !media.revealed(messageId)
    );
}

const MEME_FALLBACK = "/assets/memefighter.svg";

/**
 * An image, video, GIF or meme as MediaMessage's tile. In low bandwidth an image's or GIF's
 * full-size URL isn't handed over until the reader asks for it (5a invariant 1): an image shows
 * its thumbnail, a GIF nothing, until it's revealed.
 */
export function mediaTile(
    content: MediaContent,
    hidden: boolean,
    url: MediaView["url"],
): { kind: MediaKind; items: { src?: string; w?: number; h?: number }[]; caption: string } {
    switch (content.kind) {
        case "image_content":
            return {
                kind: "image",
                items: [
                    {
                        src: hidden ? content.thumbnailData : url(content.blobUrl),
                        w: content.width,
                        h: content.height,
                    },
                ],
                caption: content.caption ?? "",
            };
        case "meme_fighter_content":
            return {
                kind: "image",
                items: [{ src: content.url || MEME_FALLBACK, w: content.width, h: content.height }],
                caption: "",
            };
        case "giphy_content":
            // the desktop rendition is a video; the tile is the GIF image
            return {
                kind: "gif",
                items: [
                    {
                        src: hidden ? undefined : content.mobile.url,
                        w: content.mobile.width,
                        h: content.mobile.height,
                    },
                ],
                caption: content.caption ?? "",
            };
        case "video_content":
            return {
                kind: "video",
                items: [
                    {
                        src: url(content.imageData.blobUrl) ?? content.thumbnailData,
                        w: content.width,
                        h: content.height,
                    },
                ],
                caption: content.caption ?? "",
            };
    }
}

export type PreviewCard = NonNullable<Extract<GroupMessage, { kind?: "text" }>["previews"]>[number];

/**
 * A text message's link previews as cards: a landscape image on top, a square or tall one as a
 * thumbnail, as the old desktop lays them out. A card links only to an http(s) URL.
 */
export function previewCards(previews: OgPreview[]): PreviewCard[] {
    return previews.map((p) => {
        const card = ogPreviewCard(p);
        const image = card.image;
        return {
            url: card.href ?? "",
            domain: card.hostname,
            title: p.title,
            description: p.description,
            image: image?.url,
            imageBg: image === undefined ? null : undefined,
            size: card.sideBySide ? "compact" : "large",
        };
    });
}

export type PlayerProps = NonNullable<Extract<GroupMessage, { kind?: "text" }>["players"]>[number];

const TWITCH_LOGO = "/assets/twitch.svg";

/**
 * A Twitch link's player (PlayerCard), as the old trees' TwitchPlayer shows it: its poster's title
 * is the link's preview's, if the sender fetched one that says what it is, else where it's to
 * (`twitchPoster`); it plays here only where Twitch lets it (`twitchParent`), else it links to
 * Twitch. Unlike the old trees, a channel's poster is what it's streaming now
 * (`twitchLiveThumbnailUrl`), not its preview's image (the channel's avatar, and none at all when
 * the sender's preview fetch failed); a video or clip has no picture to show (Twitch gives a
 * preview fetch only its logo), so its poster is the black frame and its title.
 */
export function twitchPlayer(
    player: TwitchPlayerPreview,
    ctx: Pick<ConversationContext, "twitchParent" | "text">,
): PlayerProps {
    const poster = twitchPoster(player.embed, player.ogPreview);
    return {
        title: poster.title,
        image:
            player.embed.kind === "twitch_channel"
                ? twitchLiveThumbnailUrl(player.embed.login)
                : poster.image,
        src: ctx.twitchParent === undefined ? "" : twitchPlayerUrl(player.embed, ctx.twitchParent),
        href: twitchWatchUrl(player.embed),
        logo: TWITCH_LOGO,
        playLabel: ctx.text(i18nKey("twitch.play", { title: poster.title })),
        watchLabel: ctx.text(i18nKey("twitch.watchOnTwitch")),
    };
}

/** A message's text: a text message's own, and for other kinds (until they're built) their text. */
export function messageText(
    content: MessageContent,
    ctx: Pick<ConversationContext, "contentText">,
) {
    return content.kind === "text_content" ? content.text : ctx.contentText(content);
}

/**
 * A quoted message's text, as a reply's quote and the composer's reply or edit strip show it: as
 * it is, not as markdown, so its mentions show as the @names typed rather than `@UserId(…)`, as
 * the old trees' quotes (Markdown) show them. A copied message's text is this too
 * (`copyableMessageText`, which needs no ConversationContext).
 */
export function quoteText(
    content: MessageContent,
    ctx: Pick<ConversationContext, "contentText" | "mentionsAsTyped">,
): string {
    return ctx.mentionsAsTyped(messageText(content, ctx));
}

/**
 * Whether a run of messages shows its sender's name over it: once, at the run's start, in a group
 * or channel, the reader's own runs as well as others'; never in a DM.
 */
export function showsSenderName(runStart: boolean, direct: boolean): boolean {
    return runStart && !direct;
}

/**
 * A message as MessageGroup shows it, with its sender: a kind with a bubble of its own in it
 * (`kindMessage`), any other as a text bubble, with its text (`kindText` in the app's words, else
 * `contentText`; GAPS.md, "Message kinds").
 * A reply carries its quote whatever its kind.
 */
export function messageRow(
    evt: EventWrapper<Message>,
    status: MessageStatus,
    ctx: ConversationContext,
): MessageRow {
    const msg = evt.event;
    const mine = msg.sender === ctx.me;
    const reply = msg.repliesTo;
    const quoted = reply?.kind === "rehydrated_reply_context" ? reply : undefined;
    const links = linkPreviews(msg);
    // every kind shows the quote at its top, as the text bubble does
    const quote: QuoteFields = {
        quoteName:
            quoted === undefined
                ? undefined
                : quoted.senderId === ctx.me
                  ? ctx.you
                  : ctx.userName(quoted.senderId),
        quoteText: quoted === undefined ? undefined : quoteText(quoted.content, ctx),
    };
    const kind = kindMessage(msg, status, ctx, {
        id: String(msg.messageId),
        time: ctx.time(evt.timestamp),
        deleted: false,
        reactions: msg.reactions.map((r) => ({
            emoji: r.reaction,
            count: r.userIds.size,
            mine: r.userIds.has(ctx.me),
        })),
        tips: tipChips(msg.tips, ctx),
        ...threadFields(msg, ctx),
        ...quote,
    });
    if (kind !== undefined) {
        return {
            side: mine ? "sent" : "received",
            senderName: ctx.userName(msg.sender),
            color: senderColor(msg.sender),
            avatarUrl: ctx.avatar(msg.sender),
            message: kind,
        };
    }
    return {
        side: mine ? "sent" : "received",
        senderName: ctx.userName(msg.sender),
        color: senderColor(msg.sender),
        avatarUrl: ctx.avatar(msg.sender),
        message: {
            id: String(msg.messageId),
            kind: "text",
            text: kindText(msg.content, ctx) ?? messageText(msg.content, ctx),
            time: ctx.time(evt.timestamp),
            status,
            // a bot's message is edited as it's finalised, which isn't an edit to show
            edited:
                msg.edited && !(msg.senderContext?.kind === "bot" && msg.senderContext.finalised),
            forwarded: msg.forwarded,
            deleted: msg.content.kind === "deleted_content",
            ...(msg.content.kind === "deleted_content"
                ? {
                      deletedText: deletedText(
                          msg.content,
                          mine,
                          ctx.undeleting(msg.messageId),
                          ctx,
                      ),
                      ...deletedInfo(msg.content, ctx),
                  }
                : {}),
            reactions: msg.reactions.map((r) => ({
                emoji: r.reaction,
                count: r.userIds.size,
                mine: r.userIds.has(ctx.me),
            })),
            tips: tipChips(msg.tips, ctx),
            ...quote,
            ...threadFields(msg, ctx),
            previews: previewCards(links.cards),
            players: links.players.map((player) => twitchPlayer(player, ctx)),
        },
    };
}

/** A reply's quote: who wrote the quoted message ("You" for the reader's own) and its text. */
type QuoteFields = {
    quoteName: string | undefined;
    quoteText: string | undefined;
};

type KindBase = {
    id: string;
    time: string;
    deleted: false;
    reactions: GroupMessage["reactions"];
    tips: GroupMessage["tips"];
} & ThreadFields &
    QuoteFields;

/**
 * The tips a message got, a chip per token (its logo and the total), the reader's own marked, with
 * who tipped as its tooltip, as the old trees' tip thumbnails sum them. A token the registry
 * doesn't carry has no chip. TODO(design): the design has no tips; they go before the reactions.
 */
export function tipChips(
    tips: TipsReceived,
    ctx: Pick<ConversationContext, "me" | "you" | "token" | "userName">,
): NonNullable<GroupMessage["tips"]> {
    const chips: NonNullable<GroupMessage["tips"]> = [];
    for (const [ledger, byUser] of Object.entries(tips)) {
        const token = ctx.token(ledger);
        const tippers = Object.keys(byUser);
        if (token === undefined || tippers.length === 0) continue;
        const total = Object.values(byUser).reduce((sum, amount) => sum + amount, 0n);
        chips.push({
            amount: token.amount(total),
            symbol: token.symbol,
            logo: `url("${token.logo}") center / cover`,
            mine: tippers.includes(ctx.me),
            label: tippers
                .map((userId) => (userId === ctx.me ? ctx.you : ctx.userName(userId)))
                .join(", "),
        });
    }
    return chips;
}

/**
 * A deleted message's placeholder: "You deleted this message" in your own bubble deleted by you,
 * else "This message was deleted" (who and when are in its popover, `deletedInfo`). While it's
 * being undeleted it says so, as the old trees do ("Undeleting message by …").
 */
export function deletedText(
    content: DeletedContent,
    mine: boolean,
    undeleting: boolean,
    ctx: Pick<ConversationContext, "me" | "userName" | "longDate" | "text">,
): string {
    if (undeleting) {
        return ctx.text(
            i18nKey("undeletingMessage", {
                username: ctx.userName(content.deletedBy),
                timestamp: ctx.longDate(content.timestamp),
            }),
        );
    }
    return ctx.text(
        i18nKey(
            mine && content.deletedBy === ctx.me ? "deletedMessage.mine" : "deletedMessage.theirs",
        ),
    );
}

/** Who deleted a message, as its placeholder's popover names them, and when. */
export type DeletedInfo = {
    /**
     * The popover's first line, whole, in the app's language: "Deleted by you", "Deleted by a
     * moderator" (the OpenChat bot's removal for breaking a platform rule), or "Deleted by Alice".
     */
    deletedBy?: string;
    /** "Today at 14:32". */
    deletedAt?: string;
};

/**
 * Who deleted a message and when, for its placeholder's popover: the reader, the OpenChat bot,
 * which removes messages for the platform's moderators ("a moderator"), or anyone else by their
 * name, each a whole sentence of its own, so every language words it in full; and the day and
 * time. Only what the message carries: none of either, no popover.
 */
export function deletedInfo(
    content: DeletedContent,
    ctx: Pick<ConversationContext, "me" | "userName" | "dayAndTime" | "text">,
): DeletedInfo {
    const info: DeletedInfo = {};
    const by = content.deletedBy;
    if (by === ctx.me) info.deletedBy = ctx.text(i18nKey("deletedMessage.byYou"));
    else if (by === OPENCHAT_BOT_USER_ID)
        info.deletedBy = ctx.text(i18nKey("deletedMessage.byModerator"));
    else if (by !== "")
        info.deletedBy = ctx.text(i18nKey("deletedMessage.by", { name: ctx.userName(by) }));
    if (content.timestamp > 0n) info.deletedAt = ctx.dayAndTime(content.timestamp);
    return info;
}

/** The kinds `kindText` words, shown as a text bubble with their text as markdown. */
const WORDED_KINDS: ReadonlySet<MessageContent["kind"]> = new Set<MessageContent["kind"]>([
    "blocked_content",
    "restricted_content",
    "unsupported_content",
    "placeholder_content",
    "message_reminder_created_content",
    "message_reminder_content",
    "user_referral_card",
]);

/** Whether a message's kind shows as a text bubble with the words `kindText` gives it. */
export function isWordedKind(content: MessageContent): boolean {
    return WORDED_KINDS.has(content.kind);
}

/**
 * A kind that has no bubble of its own, in the old trees' words (they show it as a line of text):
 * a hidden message, one this version can't show, a placeholder, a reminder (with its notes), the
 * referral card (with the reader's link). Undefined for every other kind.
 * TODO(design): none of these is in the design.
 */
export function kindText(
    content: MessageContent,
    ctx: Pick<ConversationContext, "text" | "longDate" | "referralLink">,
): string | undefined {
    const withNotes = (line: string, notes: string | undefined) =>
        notes === undefined || notes.trim() === "" ? line : `${line}\n\n${notes}`;
    switch (content.kind) {
        case "blocked_content":
            return ctx.text(i18nKey("messageBlocked"));
        case "restricted_content":
            return ctx.text(i18nKey("appStore.messageNotAvailable"));
        case "unsupported_content":
            return ctx.text(i18nKey("messageUnsupported"));
        case "placeholder_content":
            return ctx.text(i18nKey("placeholderContent"));
        case "message_reminder_created_content":
            // a cancelled reminder promises nothing: the timeline folds it away with the
            // deleted messages (groupEvents' messageIsHidden), as the old trees; anywhere else
            // it shows its notes alone, as before 5a
            if (content.hidden) return content.notes ?? "";
            return withNotes(
                `⏰ ${ctx.text(i18nKey("reminders.remindAt", { datetime: ctx.longDate(content.remindAt) }))}`,
                content.notes,
            );
        case "message_reminder_content":
            return withNotes(`⏰ ${ctx.text(i18nKey("reminders.youAsked"))}`, content.notes);
        case "user_referral_card":
            return [
                ctx.text(i18nKey("referralHeader")),
                ctx.text(i18nKey("userReferralMessage")),
                ctx.referralLink,
            ].join("\n\n");
        default:
            return undefined;
    }
}

/**
 * A message's thread as its link under it (design pass 8), whatever its kind: on the thread's root
 * message, the one that started it.
 */
export type ThreadFields = {
    threadCount: number;
    threadLastAt: string | undefined;
    /** Up to three of those in the thread, in the colours their avatars have in the conversation (`face`). */
    threadFaces: string[];
    /** Its unread replies (`unreadInThread`): "· N new". */
    threadNew: number;
    /** It's the thread open beside the conversation. */
    threadActive: boolean;
};

/** The most faces a thread link shows (pass 8). */
const THREAD_FACES = 3;

/** Whether the message's thread is the one open beside the conversation (`openThread`). */
export function isOpenThread(msg: Message, openThread: number | undefined): boolean {
    return msg.thread !== undefined && msg.messageIndex === openThread;
}

/**
 * A message's thread: how many replies, when the last came, who's in it (up to three, each the
 * colour of their avatar in the conversation, `face`), how many replies are unread and whether
 * it's the one open. None without a thread, or in a view that shows no threads (`threads`).
 */
export function threadFields(
    msg: Message,
    ctx: Pick<ConversationContext, "date" | "openThread" | "face" | "unreadInThread" | "threads">,
): ThreadFields {
    const thread = ctx.threads ? msg.thread : undefined;
    return {
        threadCount: thread?.numberOfReplies ?? 0,
        threadLastAt: thread === undefined ? undefined : ctx.date(thread.latestEventTimestamp),
        threadFaces:
            thread === undefined
                ? []
                : [...thread.participantIds].slice(0, THREAD_FACES).map(ctx.face),
        threadNew: thread === undefined ? 0 : ctx.unreadInThread(msg.messageIndex),
        threadActive: thread !== undefined && isOpenThread(msg, ctx.openThread),
    };
}

/**
 * A message of a kind with its own bubble (media, voice, file); undefined for one shown as text.
 * A voice message's playing state is the screen's, so it starts here at rest.
 */
function kindMessage(
    msg: Message,
    status: MessageStatus,
    ctx: ConversationContext,
    base: KindBase,
): GroupMessage | undefined {
    const content = msg.content;
    // the bubble shows a failed send itself
    const upload = status === "failed" ? { state: "failed" as const } : null;
    if (isMedia(content)) {
        const hidden = mediaHeld(content, msg.messageId, ctx.media);
        return {
            ...base,
            ...mediaTile(content, hidden, ctx.media.url),
            status: status === "failed" ? null : status,
            upload,
        };
    }
    switch (content.kind) {
        case "audio_content":
            return {
                ...base,
                kind: "voice",
                levels: waveformLevels(content.samples),
                progress: 0,
                elapsed: formatClock(0),
                total: formatClock(Number(content.durationMs) / 1000),
            };
        case "crypto_content":
            return transferMessage(msg.sender, content, ctx, base);
        case "poll_content":
            return pollMessage(msg.sender, content, ctx, base);
        case "prize_content":
            return prizeMessage(msg.sender, content, ctx, base);
        case "prize_winner_content":
            return prizeWinnerMessage(content, ctx, base);
        case "prize_content_initial":
            // still on its way: the card as it will land; a failed one stays text, which says so
            return status === "failed"
                ? undefined
                : prizeMessage(msg.sender, sendingPrize(content), ctx, base, true);
        case "p2p_swap_content":
            return swapMessage(msg.sender, content, ctx, base);
        case "proposal_content":
            return proposalMessage(msg.messageId, content, ctx, base);
        case "p2p_swap_content_initial":
            // still on its way: the card as it will land; a failed one stays text, which says so
            return status === "failed"
                ? undefined
                : swapMessage(msg.sender, sendingSwap(content, ctx.now), ctx, base, true);
        case "file_content":
            return {
                ...base,
                kind: "file",
                fileName: content.name,
                size: formatFileSize(content.fileSize),
                caption: content.caption ?? "",
                upload,
            };
    }
    return undefined;
}

/**
 * A transfer's card: + for the reader's own receipt, − for their own send, no sign between two
 * others; outside a DM it says who got it unless that's the reader. A failed transfer, or one in a
 * ledger the registry doesn't carry, shows as text (nothing about its amount can be trusted).
 */
function transferMessage(
    sender: string,
    content: CryptocurrencyContent,
    ctx: ConversationContext,
    base: KindBase,
): GroupMessage | undefined {
    const transfer = content.transfer;
    if (transfer.kind === "failed") return undefined;
    const token = ctx.token(transfer.ledger);
    if (token === undefined) return undefined;
    const direction = transfer.recipient === ctx.me ? "in" : sender === ctx.me ? "out" : "other";
    return {
        ...base,
        kind: "transfer",
        amount: token.amount(transfer.amountE8s),
        symbol: token.symbol,
        mark: "",
        gradient: `url("${token.logo}") center / cover`,
        usd: token.usd(transfer.amountE8s),
        direction,
        recipient: ctx.direct || direction === "in" ? undefined : ctx.userName(transfer.recipient),
        caption: content.caption ?? "",
    };
}

/**
 * A prize's win (the thread under a prize gets one per winner) as a transfer's card: + for the
 * reader's own, no sign for someone else's, saying who won what as the old trees do (without their
 * bold). One in a ledger the registry doesn't carry shows as text.
 * TODO(design): the design has no prize win; the old trees' was a spinning coin over its line.
 */
function prizeWinnerMessage(
    content: PrizeWinnerContent,
    ctx: ConversationContext,
    base: KindBase,
): GroupMessage | undefined {
    const transfer = content.transaction;
    const token = ctx.token(transfer.ledger);
    if (token === undefined) return undefined;
    const mine = transfer.recipient === ctx.me;
    const amount = token.amount(transfer.amountE8s);
    return {
        ...base,
        kind: "transfer",
        amount,
        symbol: token.symbol,
        mark: "",
        gradient: `url("${token.logo}") center / cover`,
        usd: token.usd(transfer.amountE8s),
        direction: mine ? "in" : "other",
        caption: ctx
            .text(
                i18nKey("prizes.winner", {
                    recipient: mine ? ctx.you : ctx.userName(transfer.recipient),
                    amount,
                    token: token.symbol,
                }),
            )
            .replaceAll("**", ""),
    };
}

/**
 * A poll's card. It's locked when it can't be voted on (5a invariant 4, `pollView`), and its counts
 * show only when the poll lets the reader see them.
 */
function pollMessage(
    sender: string,
    content: PollContent,
    ctx: ConversationContext,
    base: KindBase,
): GroupMessage {
    const config = content.config;
    const view = pollView(content, {
        me: ctx.me,
        sender,
        direct: ctx.direct,
        readonly: ctx.readonly,
    });
    return {
        ...base,
        kind: "poll",
        question: config.text ?? "",
        options: config.options.map((label, i) => ({
            label,
            votes: votesForAnswer(content, i),
        })),
        multiple: config.allowMultipleVotesPerUser,
        publicVotes: !config.anonymous,
        canChange: allowsVoteChange(config),
        closed: content.ended,
        endsIn: config.endDate === undefined ? "" : timeLeft(Number(config.endDate) - ctx.now),
        myVotes: content.votes.user,
        readonly: view.cannotVote,
        showResults: view.showVotes,
    };
}

/**
 * A governance proposal's card, as the old trees show it: its type and proposer (a known team's
 * neuron by name), whether it's critical, its tally against the share it needs to pass when voting
 * ends (`minYesPercentageOfTotal`) and to pass at once (`minYesPercentageOfExercised`), how long
 * voting has left, and the reader's vote (cast this session, else the proposal's own). Adopt and
 * Reject until its deadline, whatever its outcome (`proposalVoting`), while the reader hasn't voted
 * and the chat isn't read-only, as the old cards. Its summary and payload are on its page
 * (Proposal details), not on the card.
 */
function proposalMessage(
    messageId: bigint,
    content: ProposalContent,
    ctx: ConversationContext,
    base: KindBase,
): GroupMessage {
    const proposal = content.proposal;
    const vote = proposalVoteStatus(ctx.proposalVote(messageId), content.myVote);
    const outcome = proposalOutcome(proposal.status);
    const { open, left } = proposalVoting(proposal.deadline, ctx.now);
    return {
        ...base,
        kind: "proposal",
        title: proposal.title,
        topic: proposalTopicLabel(content, ctx.proposalTopics),
        proposer: neuronLabel(proposal.proposer, NamedNeurons),
        critical: isCriticalProposal(proposal),
        state: outcome,
        adopt: proposalVotePercent(proposal.tally.yes, proposal.tally),
        reject: proposalVotePercent(proposal.tally.no, proposal.tally),
        softThreshold: proposal.minYesPercentageOfTotal,
        hardThreshold: proposal.minYesPercentageOfExercised,
        when: open
            ? `${ctx.text(i18nKey("proposal.votingPeriodRemaining"))}: ${left}`
            : ctx.text(i18nKey("proposal.votingPeriodEnded")),
        myVote:
            vote === undefined
                ? null
                : vote === "adopted" || vote === "adopting"
                  ? "adopt"
                  : "reject",
        canVote: open && vote === undefined && !ctx.readonly,
    };
}

/**
 * A prize's card: Claim only where `prizeView` offers it (not the sender's, not in a DM, not once
 * claimed, ended or all taken, not to a reader who misses a requirement). One in a ledger the
 * registry doesn't carry shows as text.
 */
function prizeMessage(
    sender: string,
    content: PrizeContent,
    ctx: ConversationContext,
    base: KindBase,
    sending = false,
): GroupMessage | undefined {
    const token = ctx.token(content.ledger);
    if (token === undefined) return undefined;
    const view = prizeView(content, {
        ...ctx.claimant,
        mine: sender === ctx.me,
        direct: ctx.direct,
        now: ctx.now,
    });
    const left = Number(content.endDate) - ctx.now;
    return {
        ...base,
        kind: "prize",
        token: { symbol: token.symbol, mark: "", gradient: `url("${token.logo}") center / cover` },
        winners: content.prizesRemaining + content.prizesPending + content.winnerCount,
        claimed: content.winnerCount,
        endsIn: view.finished ? "" : timeLeft(left),
        endingSoon: left < 3_600_000,
        gates: view.gates.map((g) => ({ label: ctx.text(g.label), met: g.met })),
        state: view.claimedByYou ? "claimed" : view.finished ? "ended" : "open",
        canClaim: view.canClaim && !sending,
        sending,
        note: content.caption ?? "",
    };
}

/** A prize still being sent, as it will land: every prize left, none claimed yet. */
export function sendingPrize(content: PrizeContentInitial): PrizeContent {
    return {
        kind: "prize_content",
        prizesRemaining: content.prizes.length,
        prizesPending: 0,
        winnerCount: 0,
        userIsWinner: false,
        diamondOnly: content.diamondOnly,
        lifetimeDiamondOnly: content.lifetimeDiamondOnly,
        uniquePersonOnly: content.uniquePersonOnly,
        streakOnly: content.streakOnly,
        minChitEarned: content.minChitEarned,
        minAccountAgeMs: content.minAccountAgeMs || undefined,
        token: content.transfer.token,
        ledger: content.transfer.ledger,
        endDate: content.endDate,
        caption: content.caption,
    };
}

/**
 * A swap offer's card, read from the reader's side: what they'd pay on top (the sender pays token0,
 * anyone else token1), what they'd get below. Cancel for its sender and Accept for anyone else only
 * while it's open and the chat isn't read-only (`swapActions`); once taken it says how far it got
 * (`swapLabels`). One with a token the registry doesn't carry shows as text.
 */
function swapMessage(
    sender: string,
    content: P2PSwapContent,
    ctx: ConversationContext,
    base: KindBase,
    sending = false,
): GroupMessage | undefined {
    const token0 = ctx.token(content.token0.ledger);
    const token1 = ctx.token(content.token1.ledger);
    if (token0 === undefined || token1 === undefined) return undefined;
    const mine = sender === ctx.me;
    const labels = swapLabels(content, { me: ctx.me, mine });
    const { canAccept, canCancel } = swapActions(content, {
        mine,
        now: ctx.now,
        readonly: ctx.readonly,
    });
    // amounts in the message's own token info, which is what the swap settles in
    const leg = (token: TransferToken, info: TokenInfo, amount: bigint) => ({
        amount: formatTokens(amount, info.decimals),
        symbol: info.symbol,
        mark: "",
        gradient: `url("${token.logo}") center / cover`,
        usd: token.usd(amount),
    });
    const zero = leg(token0, content.token0, content.token0Amount);
    const one = leg(token1, content.token1, content.token1Amount);
    const status = content.status.kind;
    const state =
        status === "p2p_swap_open"
            ? ctx.now < Number(content.expiresAt)
                ? "open"
                : "expired"
            : status === "p2p_swap_cancelled"
              ? "cancelled"
              : status === "p2p_swap_expired"
                ? "expired"
                : status === "p2p_swap_completed"
                  ? "done"
                  : "pending";
    const doneKey =
        state === "done" && !labels.takenByYou && !mine
            ? "p2pSwap.accepted"
            : labels.buttonLabelKey;
    return {
        ...base,
        kind: "swap",
        give: mine ? zero : one,
        get: mine ? one : zero,
        state,
        expiresIn: state === "open" ? timeLeft(Number(content.expiresAt) - ctx.now) : "",
        doneText: ctx.text(i18nKey(doneKey)),
        caption: content.caption ?? "",
        canAct: (canAccept || canCancel) && !sending,
        sending,
    };
}

/** A swap offer still being sent, as it will land: open, for as long as it was given from now. */
export function sendingSwap(content: P2PSwapContentInitial, now: number): P2PSwapContent {
    return {
        kind: "p2p_swap_content",
        token0: content.token0,
        token1: content.token1,
        token0Amount: content.token0Amount,
        token1Amount: content.token1Amount,
        caption: content.caption,
        expiresAt: BigInt(now) + content.expiresIn,
        status: { kind: "p2p_swap_open" },
        swapId: 0,
        token0TxnIn: 0n,
    };
}

/**
 * Whether a proposal can still be voted on, and how long it has left ("3d", "5h", "12m"): until its
 * deadline, whatever its outcome, as the old cards (the NNS keeps voting open after a proposal is
 * decided early, for the voting rewards). Rows key on it (`RowCache`), and a proposals chat's
 * screen makes its rows' context again every minute (`PROPOSAL_CLOCK_MS`), so a card stops
 * offering a vote at its deadline and its countdown keeps up.
 */
export function proposalVoting(deadline: number, now: number): { open: boolean; left: string } {
    const ms = deadline - now;
    return ms > 0 ? { open: true, left: timeLeft(ms) } : { open: false, left: "" };
}

/** How often a proposals chat's rows' context is made again, for its cards' deadlines. */
export const PROPOSAL_CLOCK_MS = 60_000;

/** Whether a chat is a proposals chat, whose cards count down to their deadlines (`proposalVoting`). */
export function hasProposals(chat: ChatSummary | undefined): boolean {
    return (
        chat !== undefined &&
        chat.kind !== "direct_chat" &&
        chat.subtype?.kind === "governance_proposals"
    );
}

/** Time left as its largest unit: 3d, 5h, 12m (under a minute counts as 1m). */
function timeLeft(ms: number): string {
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** How long until the next local day starts, so labels like "Today" can be redone then. */
export function untilNextDay(now: Date): number {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
}

/**
 * A message with more fields set, keeping its live fields live: a voice message's playback
 * (`playing`, `progress`, `elapsed`, `speed`) are getters onto the screen's player, which a spread
 * would read once and freeze, as the row's messages are kept between renders.
 */
export function withFields<T extends object>(message: T, fields: Partial<T>): T {
    const composed = {} as T;
    Object.defineProperties(composed, {
        ...Object.getOwnPropertyDescriptors(message),
        ...Object.getOwnPropertyDescriptors(fields),
    });
    return composed;
}

/** What a conversation's ConversationContext is made from: the client, and the stores' values. */
export type ConversationContextInput = {
    client: Pick<
        OpenChat,
        | "displayName"
        | "getContentAsText"
        | "toShortTimeString"
        | "formatMessageDate"
        | "isChatReadOnly"
        | "unreadThreadMessageCount"
        | "canonicalOrigin"
    >;
    chat: ChatSummary | undefined;
    me: string;
    formatter: MessageFormatter;
    users: UserLookup;
    /**
     * The user groups a quote's mentions can name: every community's (userGroupSummariesStore), as
     * the bubble's Markdown looks them up (a forwarded message can name another community's).
     */
    userGroups: MentionLookups["userGroups"];
    /** The chat's webhooks, and the ids of those that have sent messages in it. */
    webhooks: ReadonlyMap<string, WebhookDetails>;
    webhookIds: ReadonlySet<string>;
    /** Whether the chat's details (which hold its webhooks) have loaded. */
    detailsLoaded: boolean;
    lowBandwidth: boolean;
    /** Whether the reader asked to see this message's full-size media (low bandwidth). */
    revealed: (messageId: bigint) => boolean;
    claimant: ConversationContext["claimant"];
    tokens: ReadonlyMap<string, CryptocurrencyDetails>;
    /** The exchange rates, read when a dollar value is worked out (they refresh every few minutes). */
    rates: () => ReadonlyMap<string, TokenExchangeRates>;
    /** The thread open beside the conversation (its root's index), if any. */
    openThread?: number;
    /** A user's face as the view shows it (their avatar's colour). */
    face: (userId: string) => string;
    /** Whether the view shows threads (a message's thread link); the native tree has no thread screen yet. */
    threads: boolean;
    /** The app's language, for dates said in full. */
    locale: string;
    /** Whether a deleted message is being undeleted (`undeletingMessagesStore`). */
    undeleting: (messageId: bigint) => boolean;
    /** Where a Twitch link's player can play (`twitchPlayerParent`); none, a link to Twitch. */
    twitchParent: string | undefined;
    /** The proposals chat's names for its proposals' types (`proposalTopicsStore`). */
    proposalTopics: ReadonlyMap<number, string>;
    /** This session's votes on proposals (`proposalVotesStore`). */
    proposalVotes: ReadonlyMap<bigint, ProposalVoteStatus>;
};

/** The ConversationContext a conversation's rows are made with. */
export function conversationContext(input: ConversationContextInput): ConversationContext {
    const { client, chat, formatter, users, webhooks, webhookIds, detailsLoaded } = input;
    return {
        me: input.me,
        you: formatter("you"),
        // a webhook's messages are sent as it, named as the old timeline names them (findUser)
        userName: (userId) =>
            isDeletedWebhook(userId, webhooks, webhookIds, detailsLoaded)
                ? formatter("webhook.deleted")
                : client.displayName(findUser(userId, users, webhooks)),
        contentText: (content) => client.getContentAsText(formatter, content),
        mentionsAsTyped: typedMentions({ users, userGroups: input.userGroups }),
        time: (timestamp) => client.toShortTimeString(new Date(Number(timestamp))),
        date: (timestamp) =>
            client.formatMessageDate(
                timestamp,
                formatter("today"),
                formatter("yesterday"),
                true,
                true,
            ),
        longDate: (timestamp) => toLongDatetimeString(new Date(Number(timestamp)), input.locale),
        dayAndTime: (timestamp) =>
            interpolateNewUi(
                formatter,
                i18nKey("deletedMessage.when", {
                    day: client.formatMessageDate(
                        timestamp,
                        formatter("today"),
                        formatter("yesterday"),
                    ),
                    time: client.toShortTimeString(new Date(Number(timestamp))),
                }),
            ),
        media: {
            lowBandwidth: input.lowBandwidth,
            revealed: input.revealed,
            url: getProxyAdjustedBlobUrl,
        },
        direct: chat?.kind === "direct_chat",
        readonly: chat !== undefined && client.isChatReadOnly(chat.id),
        now: Date.now(),
        claimant: input.claimant,
        text: (key) => interpolateNewUi(formatter, key),
        openThread: input.openThread,
        face: input.face,
        avatar: (userId) => ownUserAvatarUrl(findUser(userId, users, webhooks)),
        threads: input.threads,
        undeleting: input.undeleting,
        referralLink: referralLink(client.canonicalOrigin(), input.me),
        twitchParent: input.twitchParent,
        proposalTopics: input.proposalTopics,
        proposalVote: (messageId) => input.proposalVotes.get(messageId),
        unreadInThread: (root) =>
            threadUnreadCount(chat, root, (latest) =>
                chat === undefined ? 0 : client.unreadThreadMessageCount(chat.id, root, latest),
            ),
        token: (ledger) => {
            const token = input.tokens.get(ledger);
            if (token === undefined) return undefined;
            return {
                symbol: token.symbol,
                logo: token.logo,
                amount: (e8s) => formatTokens(e8s, token.decimals),
                usd: (e8s) => {
                    const { dollarBalance } = getConvertedBalances(
                        input.rates(),
                        e8s,
                        token.decimals,
                        ledger,
                    );
                    return dollarBalance === undefined
                        ? ""
                        : formatConvertedValue("usd", dollarBalance);
                },
            };
        },
    };
}
