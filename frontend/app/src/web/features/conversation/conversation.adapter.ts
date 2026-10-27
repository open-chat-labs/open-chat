import {
    allowsVoteChange,
    formatClock,
    formatFileSize,
    formatTokens,
    i18nKey,
    ogPreviewCard,
    pollView,
    prizeView,
    swapActions,
    swapLabels,
    votesForAnswer,
    waveformLevels,
    type CryptocurrencyContent,
    type EventWrapper,
    type GiphyContent,
    type ImageContent,
    type MemeFighterContent,
    type Message,
    type MessageContent,
    type OgPreview,
    type P2PSwapContent,
    type PollContent,
    type PrizeContent,
    type PrizeReader,
    type ResourceKey,
    type TokenInfo,
    type VideoContent,
} from "@client";
import type ChatBubble from "@openchat/ui/src/lib/components/ChatBubble.svelte";
import type { GroupMessage, MenuItem } from "@openchat/ui/src/lib/types";
import type { ComponentProps } from "svelte";
import type { ChatMenuAction } from "@src/logic/chats/chatMenu";
import { pickById } from "../../pickById";

// A conversation's messages to MessageGroup's messages (DATA.md, Conversation). The timeline's
// other events are worded by logic/conversation/timelineEventText, as in the old trees. The
// client's lookups (names, text, dates) come in through ConversationContext, so this stays pure.

export type SenderColor = "violet" | "amber" | "teal" | "blue";

// senders have uploaded avatars rather than the design's colours, so one is picked from the id
// (GAPS.md, Swatches)
const COLOURS: readonly SenderColor[] = ["violet", "amber", "teal", "blue"];

export function senderColor(id: string): SenderColor {
    return pickById(id, COLOURS);
}

export type ConversationContext = {
    /** The signed-in user's id. */
    me: string;
    /** "You", in the app's language. */
    you: string;
    userName: (userId: string) => string;
    /** A message's content as text, in the app's language (for kinds not shown yet, and quotes). */
    contentText: (content: MessageContent) => string;
    /** A message's time, as its bubble shows it. */
    time: (timestamp: bigint) => string;
    /** A date as the list shows it (a time today, else a short date). */
    date: (timestamp: bigint) => string;
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

export type PreviewCard = NonNullable<ComponentProps<typeof ChatBubble>["previews"]>[number];

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

/** A message's text: a text message's own, and for other kinds (until they're built) their text. */
export function messageText(
    content: MessageContent,
    ctx: Pick<ConversationContext, "contentText">,
) {
    return content.kind === "text_content" ? content.text : ctx.contentText(content);
}

/**
 * A message as MessageGroup shows it, with its sender. Every kind shows as a text bubble for now:
 * the rich kinds are phase 5 (GAPS.md).
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
    const thread = msg.thread;
    const kind = kindMessage(msg, status, ctx, {
        id: String(msg.messageId),
        time: ctx.time(evt.timestamp),
        deleted: false,
        reactions: msg.reactions.map((r) => ({
            emoji: r.reaction,
            count: r.userIds.size,
            mine: r.userIds.has(ctx.me),
        })),
    });
    if (kind !== undefined) {
        return {
            side: mine ? "sent" : "received",
            senderName: mine ? ctx.you : ctx.userName(msg.sender),
            color: senderColor(msg.sender),
            message: kind,
        };
    }
    return {
        side: mine ? "sent" : "received",
        senderName: mine ? ctx.you : ctx.userName(msg.sender),
        color: senderColor(msg.sender),
        message: {
            id: String(msg.messageId),
            kind: "text",
            text: messageText(msg.content, ctx),
            time: ctx.time(evt.timestamp),
            status,
            // a bot's message is edited as it's finalised, which isn't an edit to show
            edited:
                msg.edited && !(msg.senderContext?.kind === "bot" && msg.senderContext.finalised),
            forwarded: msg.forwarded,
            deleted: msg.content.kind === "deleted_content",
            reactions: msg.reactions.map((r) => ({
                emoji: r.reaction,
                count: r.userIds.size,
                mine: r.userIds.has(ctx.me),
            })),
            quoteName:
                quoted === undefined
                    ? undefined
                    : quoted.senderId === ctx.me
                      ? ctx.you
                      : ctx.userName(quoted.senderId),
            quoteText: quoted === undefined ? undefined : messageText(quoted.content, ctx),
            threadCount: thread?.numberOfReplies ?? 0,
            threadLastAt: thread === undefined ? undefined : ctx.date(thread.latestEventTimestamp),
            previews: msg.content.kind === "text_content" ? previewCards(msg.ogPreviews) : [],
        },
    };
}

type KindBase = { id: string; time: string; deleted: false; reactions: GroupMessage["reactions"] };

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
        case "p2p_swap_content":
            return swapMessage(msg.sender, content, ctx, base);
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
 * A prize's card: Claim only where `prizeView` offers it (not the sender's, not in a DM, not once
 * claimed, ended or all taken, not to a reader who misses a requirement). One in a ledger the
 * registry doesn't carry shows as text.
 */
function prizeMessage(
    sender: string,
    content: PrizeContent,
    ctx: ConversationContext,
    base: KindBase,
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
        canClaim: view.canClaim,
        note: content.caption ?? "",
    };
}

/**
 * A swap offer's card, read from the reader's side: what they'd pay on top (the sender pays token0,
 * anyone else token1), what they'd get below. Cancel for its sender and Accept for anyone else only
 * while it's open (`swapActions`); once taken it says how far it got (`swapLabels`). One with a
 * token the registry doesn't carry shows as text.
 */
function swapMessage(
    sender: string,
    content: P2PSwapContent,
    ctx: ConversationContext,
    base: KindBase,
): GroupMessage | undefined {
    const token0 = ctx.token(content.token0.ledger);
    const token1 = ctx.token(content.token1.ledger);
    if (token0 === undefined || token1 === undefined) return undefined;
    const mine = sender === ctx.me;
    const labels = swapLabels(content, { me: ctx.me, mine });
    const { canAccept, canCancel } = swapActions(content, { mine, now: ctx.now });
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
            ? canAccept || canCancel
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
    };
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

// ── the header's menu ──

type HeaderMenuItem = MenuItem & { id: string };

const K = "ui.conversationHeader.menu.";
const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

export type HeaderMenuState = {
    kind: "user" | "group" | "channel";
    favourite: boolean;
    muted: boolean;
    everyoneMuted: boolean;
    /** A DM with a bot can't be muted. */
    isBot: boolean;
    /** There are unread messages to mark as read. */
    unread: boolean;
    /** Leave, delete, block and unblock, as logic/chats/chatMenu offers them. */
    actions: ChatMenuAction[];
    /** "Unblock user", which the library has no words for. */
    unblockLabel: string;
    /** Someone who can edit the group or channel: "Manage", else its details. */
    canEdit: boolean;
};

/**
 * ConversationHeader's menu, as the design's (`_chatMenu`): for a group or channel, Manage (or its
 * details), favourite, mute, @everyone, mark as read and copy link, then leave; for a DM,
 * favourite, mute, chat settings, then block and delete. Leave, delete, block and unblock show only where the
 * app allows them. Picking one reports its id (`onMenu`, or `onLeave`).
 */
export function headerMenuItems(state: HeaderMenuState): HeaderMenuItem[] {
    const group = state.kind !== "user";
    const noun = state.kind === "channel" ? "Channel" : "Group";
    const items: HeaderMenuItem[] = [];
    if (group) {
        items.push({
            id: "manage",
            label: K + (state.canEdit ? `manage${noun}` : `${noun.toLowerCase()}Details`),
            mask: icon(state.canEdit ? "gear" : "info"),
        });
    }
    items.push(
        state.favourite
            ? { id: "unfavourite", label: K + "removeFromFavourites", mask: icon("heart") }
            : { id: "favourite", label: K + "addToFavourites", mask: icon("heart") },
    );
    if (!state.isBot) {
        items.push(
            state.muted
                ? { id: "unmute", label: K + "unmuteNotifications", mask: icon("bell") }
                : { id: "mute", label: K + "muteNotifications", mask: icon("bell-off") },
        );
    }
    if (!group) {
        items.push({ id: "chatSettings", label: K + "chatSettings", mask: icon("gear") });
    }
    if (group) {
        items.push(
            state.everyoneMuted
                ? { id: "unmuteEveryone", label: K + "unmuteEveryone", mask: icon("at") }
                : { id: "muteEveryone", label: K + "muteEveryone", mask: icon("at") },
        );
        if (state.unread) {
            items.push({ id: "markRead", label: K + "markAsRead", mask: icon("check") });
        }
        items.push({ id: "copyUrl", label: K + "copyUrl", mask: icon("link") });
    }
    for (const action of state.actions) {
        items.push(actionItem(action, state));
    }
    return items;
}

/** The quick panel's menu: the header's without what the panel shows as buttons (favourite,
 *  mute, @everyone) or its own cog (Manage), as the design's `_panelMenu`. */
export function panelMenuItems(state: HeaderMenuState): HeaderMenuItem[] {
    const shown = new Set([
        "manage",
        "favourite",
        "unfavourite",
        "mute",
        "unmute",
        "muteEveryone",
        "unmuteEveryone",
    ]);
    return headerMenuItems(state).filter((item) => !shown.has(item.id));
}

function actionItem(action: ChatMenuAction, state: HeaderMenuState): HeaderMenuItem {
    switch (action) {
        case "leave":
            return {
                id: "leave",
                label: K + (state.kind === "channel" ? "leaveChannel" : "leaveGroup"),
                mask: icon("exit"),
                variant: "danger",
            };
        case "delete":
            return {
                id: "delete",
                label: K + "deleteChat",
                mask: icon("trash"),
                variant: "danger",
            };
        case "block":
            return { id: "block", label: K + "blockUser", mask: icon("ban"), variant: "danger" };
        case "unblock":
            return { id: "unblock", label: state.unblockLabel, mask: icon("ban") };
    }
}
