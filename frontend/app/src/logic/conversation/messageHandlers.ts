import {
    buildTransactionUrl,
    chatIdentifiersEqual,
    formatClock,
    routeForMessage,
    type ChatIdentifier,
    type ChatListScope,
    type CryptocurrencyDetails,
    type FileContent,
    type Message,
    type MessageContent,
    type P2PSwapContent,
    type PollContent,
    type ProposalContent,
    type ReadonlyMap,
} from "@client";
import type { GroupMessage } from "@openchat/ui/src/lib/types";
import { isSingleEmoji } from "@src/utils/emojis";
import { getProxyAdjustedBlobUrl } from "@src/utils/media";
import { isMedia, isWordedKind, type MessageRow } from "./messageRow";
import type { VoicePlayer, VoiceSpeed } from "./voicePlayer.svelte";

// A message row's controls (MessageGroup's cards and players) wired to what the conversation does
// with them, for every tree that shows its messages with the library (src/web's, src/native's).
// What each does is the screen's (a dialog, a toast); which control gets which handler is here.

/** What the conversation does when a message's controls are used. */
export type MessageHandlers = {
    /** A photo, video, GIF or meme tapped. */
    openMedia: (msg: Message) => void;
    /** A transfer's card tapped: its transaction, in the block explorer. */
    openUrl: (url: string) => void;
    /** Accepting or cancelling a swap offer. None leaves the card without its button. */
    swap?: (msg: Message, content: P2PSwapContent, action: "accept" | "cancel") => void;
    claim: (msg: Message, e: MouseEvent) => void;
    /** A prize's claim is on its way (`claimsStore`). */
    claiming: (messageId: bigint) => boolean;
    vote: (msg: Message, content: PollContent, next: number[]) => void;
    download: (content: FileContent) => void;
    /** The conversation's voice player: one voice message plays at a time. */
    voice: VoicePlayer;
    /** A proposal's Adopt or Reject. None leaves its card without them. */
    voteOnProposal?: (msg: Message, content: ProposalContent, adopt: boolean) => void;
    /** A proposal's details: its page on the IC dashboard. */
    openProposal?: (content: ProposalContent) => void;
};

/**
 * A row's message with its controls' handlers. A voice message's playing state is read from the
 * player as it renders (getters), so playing doesn't redo the row; so is whether a prize's claim is
 * on its way.
 */
export function withHandlers(
    row: MessageRow,
    msg: Message,
    handlers: MessageHandlers,
    tokens: ReadonlyMap<string, CryptocurrencyDetails>,
): GroupMessage {
    const content = msg.content;
    if (isMedia(content)) {
        return { ...row.message, onOpen: () => handlers.openMedia(msg) } as GroupMessage;
    }
    switch (content.kind) {
        case "crypto_content": {
            const url = buildTransactionUrl(content.transfer, tokens);
            return url === undefined
                ? row.message
                : ({ ...row.message, onOpen: () => handlers.openUrl(url) } as GroupMessage);
        }
        case "prize_winner_content": {
            const url = buildTransactionUrl(content.transaction, tokens);
            return url === undefined || row.message.kind !== "transfer"
                ? row.message
                : ({ ...row.message, onOpen: () => handlers.openUrl(url) } as GroupMessage);
        }
        case "p2p_swap_content": {
            const swap = handlers.swap;
            return swap === undefined
                ? ({ ...row.message, canAct: false } as GroupMessage)
                : ({
                      ...row.message,
                      onAccept: () => swap(msg, content, "accept"),
                      onCancel: () => swap(msg, content, "cancel"),
                  } as GroupMessage);
        }
        case "prize_content":
            return {
                ...row.message,
                get claiming() {
                    return handlers.claiming(msg.messageId);
                },
                onClaim: (e: MouseEvent) => handlers.claim(msg, e),
            } as GroupMessage;
        case "poll_content":
            return {
                ...row.message,
                onVote: (next: number[]) => handlers.vote(msg, content, next),
            } as GroupMessage;
        case "file_content":
            return { ...row.message, onDownload: () => handlers.download(content) } as GroupMessage;
        case "proposal_content": {
            const vote = handlers.voteOnProposal;
            const open = handlers.openProposal;
            return {
                ...row.message,
                ...(vote === undefined
                    ? { canVote: false }
                    : {
                          onVote: (side: "adopt" | "reject") =>
                              vote(msg, content, side === "adopt"),
                      }),
                ...(open === undefined ? {} : { onDetails: () => open(content) }),
            } as GroupMessage;
        }
        case "audio_content": {
            const voice = handlers.voice;
            const key = row.message.id ?? "";
            const url = getProxyAdjustedBlobUrl(content.blobUrl);
            const length = Number(content.durationMs) / 1000;
            return {
                ...row.message,
                get playing() {
                    return voice.playing(key);
                },
                get progress() {
                    return length > 0 ? voice.time(key) / length : 0;
                },
                get elapsed() {
                    return formatClock(voice.time(key));
                },
                get speed() {
                    return voice.speed;
                },
                onPlay: () => voice.play(key, url),
                onPause: () => voice.pause(key),
                onSeek: (fraction: number) => voice.seek(key, url, fraction * length),
                onSpeedChange: (speed: VoiceSpeed) => voice.setSpeed(speed),
            } as GroupMessage;
        }
        default:
            return row.message;
    }
}

/**
 * Whether a text message's text goes through the app's markdown (mentions, links, custom emoji)
 * in its bubble: anything but a lone native emoji, which shows as the bubble's own, large.
 */
export function textAsMarkdown(text: string): boolean {
    return !isSingleEmoji(text) || /^!emoji\(/.test(text);
}

/**
 * The markdown a text bubble shows in place of its plain text (ChatBubble's `body`): a text
 * message's own text, but for a lone native emoji (`textAsMarkdown`), and the words of a kind
 * without a bubble of its own (`kindText`: a reminder's notes, the referral card's link). None for
 * anything else, which shows its plain text.
 */
export function bodyMarkdown(content: MessageContent, message: GroupMessage): string | undefined {
    if (content.kind === "text_content") {
        return textAsMarkdown(content.text) ? content.text : undefined;
    }
    if (isWordedKind(content) && (message.kind === undefined || message.kind === "text")) {
        return message.text;
    }
    return undefined;
}

/**
 * A failed message's Retry, where its kind has one: a text bubble's line, a file or media tile's
 * button. None for the other kinds.
 */
export function retryFor(
    message: GroupMessage,
    retry: (() => void) | undefined,
): { retryAction?: () => void; onRetry?: () => void } {
    if (retry === undefined) return {};
    switch (message.kind) {
        case undefined:
        case "text":
            return { retryAction: retry };
        case "image":
        case "video":
        case "gif":
        case "file":
            return { onRetry: retry };
        default:
            return {};
    }
}

/**
 * Where a reply's quote takes the reader when it's tapped: its message in this chat (gone to in the
 * list, loaded first if it's outside what's loaded), or, quoted from another chat (a private reply)
 * or a thread, there.
 */
export type QuoteTarget =
    | { kind: "here"; messageIndex: number }
    | { kind: "elsewhere"; url: string };

/**
 * A message's quote's target, as the old trees' RepliesTo has it; none for one that isn't a reply.
 * The list is the chat's, or the thread's with that root (`threadRootMessageIndex`): a quote from
 * the same list is "here".
 */
export function quoteTarget(
    msg: Message,
    chatId: ChatIdentifier,
    scope: ChatListScope["kind"],
    threadRootMessageIndex?: number,
): QuoteTarget | undefined {
    const reply = msg.repliesTo;
    if (reply?.kind !== "rehydrated_reply_context") return undefined;
    const source = reply.sourceContext;
    if (
        chatIdentifiersEqual(source.chatId, chatId) &&
        source.threadRootMessageIndex === threadRootMessageIndex
    ) {
        return { kind: "here", messageIndex: reply.messageIndex };
    }
    return { kind: "elsewhere", url: routeForMessage(scope, source, reply.messageIndex) };
}

/**
 * A reply's quote, tapped, goes to its target (`go`): its message's `onQuote`, whatever its kind
 * (every kind shows the quote, as the text bubble does). Nothing for a message that isn't a reply.
 */
export function quoteFor(
    target: QuoteTarget | undefined,
    go: (target: QuoteTarget) => void,
): { onQuote?: () => void } {
    if (target === undefined) return {};
    return { onQuote: () => go(target) };
}
