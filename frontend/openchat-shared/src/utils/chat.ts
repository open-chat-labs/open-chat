import type {
    ChatEvent,
    Metrics,
    ChatSummary,
    EventWrapper,
    IndexRange,
    MemberRole,
    MessageContent,
    ChatIdentifier,
    MessageContext,
    ChatListScope,
    CryptocurrencyDetails,
    VersionedRules,
    AccountTransaction,
    AttachmentContent,
    MessagePermission,
    P2PSwapStatus,
    AcceptP2PSwapResponse,
    CancelP2PSwapResponse,
} from "../domain";
import { extractUserIdsFromMentions, UnsupportedValueError } from "../domain";
import type { MessageFormatter } from "./i18n";

export function userIdsFromTransactions(transactions: AccountTransaction[]): Set<string> {
    return transactions.reduce<Set<string>>((userIds, t) => {
        // these are not necessarily userIds, but they *might* be
        if (t.from !== undefined) {
            userIds.add(t.from);
        }
        if (t.to !== undefined) {
            userIds.add(t.to);
        }
        return userIds;
    }, new Set<string>());
}

export function userIdsFromEvents(events: EventWrapper<ChatEvent>[]): Set<string> {
    const fakeFormatter = (k: string) => k;
    return events.reduce<Set<string>>((userIds, e) => {
        if ("userIds" in e.event) {
            e.event.userIds.forEach((u) => userIds.add(u));
        }
        switch (e.event.kind) {
            case "message":
                userIds.add(e.event.sender);
                if (
                    e.event.repliesTo !== undefined &&
                    e.event.repliesTo.kind === "rehydrated_reply_context"
                ) {
                    userIds.add(e.event.repliesTo.senderId);
                    extractUserIdsFromMentions(
                        getContentAsFormattedText(fakeFormatter, e.event.repliesTo.content, {}),
                    ).forEach((id) => userIds.add(id));
                }
                if (e.event.content.kind === "crypto_content") {
                    userIds.add(e.event.content.transfer.recipient);
                } else if (e.event.content.kind === "reported_message_content") {
                    e.event.content.reports.forEach((r) => userIds.add(r.reportedBy));
                } else if (e.event.content.kind === "prize_winner_content") {
                    userIds.add(e.event.content.transaction.recipient);
                }
                e.event.reactions.forEach((r) => r.userIds.forEach((u) => userIds.add(u)));
                extractUserIdsFromMentions(
                    getContentAsFormattedText(fakeFormatter, e.event.content, {}),
                ).forEach((id) => userIds.add(id));
                break;
            case "member_joined":
            case "member_left":
                userIds.add(e.event.userId);
                break;
            case "name_changed":
            case "desc_changed":
            case "rules_changed":
            case "avatar_changed":
            case "role_changed":
            case "permissions_changed":
            case "group_visibility_changed":
            case "group_invite_code_changed":
                userIds.add(e.event.changedBy);
                break;
            case "group_chat_created":
                userIds.add(e.event.created_by);
                break;
            case "members_added":
                userIds.add(e.event.addedBy);
                break;
            case "members_removed":
                userIds.add(e.event.removedBy);
                break;
            case "users_blocked":
                userIds.add(e.event.blockedBy);
                break;
            case "users_unblocked":
                userIds.add(e.event.unblockedBy);
                break;
            case "message_pinned":
                userIds.add(e.event.pinnedBy);
                break;
            case "message_unpinned":
                userIds.add(e.event.unpinnedBy);
                break;
            case "events_ttl_updated":
            case "external_url_updated":
            case "gate_updated":
                userIds.add(e.event.updatedBy);
                break;
            case "users_invited":
                userIds.add(e.event.invitedBy);
                e.event.userIds.forEach((id) => userIds.add(id));
                break;
            case "chat_frozen":
                userIds.add(e.event.frozenBy);
                break;
            case "chat_unfrozen":
                userIds.add(e.event.unfrozenBy);
                break;
            case "bot_added":
                userIds.add(e.event.addedBy);
                break;
            case "bot_removed":
                userIds.add(e.event.removedBy);
                break;
            case "bot_updated":
                userIds.add(e.event.updatedBy);
                break;
            case "aggregate_common_events":
            case "direct_chat_created":
            case "empty":
            case "members_added_to_default_channel":
                break;
            default:
                console.warn("Unexpected ChatEvent type received", e.event);
        }
        return userIds;
    }, new Set<string>());
}

export function getContentAsFormattedText(
    formatter: MessageFormatter,
    content: MessageContent,
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): string {
    let text;
    if (content.kind === "text_content") {
        text = content.text;
    } else if (content.kind === "image_content") {
        text = captionedContent("image", content.caption);
    } else if (content.kind === "video_content") {
        text = captionedContent("video", content.caption);
    } else if (content.kind === "audio_content") {
        text = captionedContent("audio", content.caption);
    } else if (content.kind === "file_content") {
        text = captionedContent(content.name, content.caption);
    } else if (content.kind === "crypto_content") {
        text = captionedContent(
            formatter("tokenTransfer.transfer", {
                values: { token: cryptoLookup[content.transfer.ledger]?.symbol ?? "Unknown" },
            }),
            content.caption,
        );
    } else if (content.kind === "deleted_content" || content.kind === "blocked_content") {
        text = "deleted message";
    } else if (content.kind === "placeholder_content") {
        text = "placeholder content";
    } else if (content.kind === "bot_placeholder_content") {
        text = "Bot working ...";
    } else if (content.kind === "poll_content") {
        text = content.config.text ?? "poll";
    } else if (content.kind === "proposal_content") {
        text = content.proposal.title;
    } else if (content.kind === "giphy_content") {
        text = captionedContent(formatter("giphyMessage"), content.caption);
    } else if (content.kind === "p2p_swap_content" || content.kind === "p2p_swap_content_initial") {
        text = captionedContent("p2p swap", content.caption);
    } else if (content.kind === "prize_content" || content.kind === "prize_content_initial") {
        text = captionedContent(formatter("prizeMessage"), content.caption);
    } else if (content.kind === "prize_winner_content") {
        text = "Prize winner message";
    } else if (content.kind === "message_reminder_content") {
        text = content.notes ?? "Message reminder";
    } else if (content.kind === "message_reminder_created_content") {
        text = content.notes ?? "Message reminder";
    } else if (content.kind === "user_referral_card") {
        text = formatter("referralHeader");
    } else if (content.kind === "reported_message_content") {
        text = "Reported message";
    } else if (content.kind === "meme_fighter_content") {
        text = "Meme Fighter message";
    } else if (content.kind === "video_call_content") {
        text = "Video call";
    } else {
        throw new UnsupportedValueError("Unrecognised content type", content);
    }
    return text.trim();
}

export function getContentAsText(content: MessageContent): string | undefined {
    if ("text" in content) {
        return content.text;
    } else if ("caption" in content) {
        return content.caption;
    } else if (content.kind === "poll_content") {
        return content.config.text;
    }
}

function captionedContent(type: string, caption?: string): string {
    if (caption) {
        return type + " - " + caption;
    } else {
        return type;
    }
}

export function indexRangeForChat(chat: ChatSummary): IndexRange {
    return [getMinVisibleEventIndex(chat), chat.latestEventIndex];
}

export function getMinVisibleEventIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleEventIndex;
}

export function getDisplayDate(chat: ChatSummary): bigint {
    let latestUpdate = BigInt(0);

    switch (chat.kind) {
        case "direct_chat":
            latestUpdate = chat.dateCreated;
            break;
        case "group_chat":
        case "channel":
            if (chat.membership?.joined !== undefined) {
                latestUpdate = chat.membership.joined;
            }
            break;
    }

    if (chat.latestMessage !== undefined && chat.latestMessage.timestamp > latestUpdate) {
        latestUpdate = chat.latestMessage.timestamp;
    }

    if (chat.eventsTtlLastUpdated > latestUpdate) {
        latestUpdate = chat.eventsTtlLastUpdated;
    }

    return latestUpdate;
}

export function compareChats(a: ChatSummary, b: ChatSummary): number {
    return Number(getDisplayDate(b) - getDisplayDate(a));
}

export function emptyChatMetrics(): Metrics {
    return {
        audioMessages: 0,
        edits: 0,
        icpMessages: 0,
        sns1Messages: 0,
        ckbtcMessages: 0,
        giphyMessages: 0,
        deletedMessages: 0,
        reportedMessages: 0,
        fileMessages: 0,
        pollVotes: 0,
        textMessages: 0,
        imageMessages: 0,
        replies: 0,
        videoMessages: 0,
        polls: 0,
        reactions: 0,
    };
}

export function emptyRules(): VersionedRules {
    return {
        text: "",
        enabled: false,
        version: 0,
    };
}

export function compareRoles(a: MemberRole, b: MemberRole): number {
    if (a === b) return 0;
    if (a === "owner") return 1;
    if (b === "owner") return -1;
    if (a === "admin") return 1;
    if (b === "admin") return -1;
    if (a === "moderator") return 1;
    if (b === "moderator") return -1;
    if (a === "member") return 1;
    return -1;
}

export function routeForMessage(
    scope: ChatListScope["kind"],
    ctx: MessageContext,
    messageIndex: number,
): string {
    return ctx.threadRootMessageIndex === undefined
        ? `${routeForMessageContext(scope, ctx)}/${messageIndex}`
        : `${routeForMessageContext(scope, ctx)}/${messageIndex}?open=true`;
}

export function routeForMessageContext(
    scope: ChatListScope["kind"],
    { chatId, threadRootMessageIndex }: MessageContext,
    open = false,
): string {
    return threadRootMessageIndex === undefined
        ? routeForChatIdentifier(scope, chatId)
        : `${routeForChatIdentifier(scope, chatId)}/${threadRootMessageIndex}${
              open ? "?open=true" : ""
          }`;
}

export function routeForChatIdentifier(scope: ChatListScope["kind"], id: ChatIdentifier): string {
    const prefix = scope === "favourite" ? "/favourite" : "";
    switch (id.kind) {
        case "direct_chat":
            return `${prefix}/user/${id.userId}`;
        case "group_chat":
            return `${prefix}/group/${id.groupId}`;
        case "channel":
            return `${prefix}/community/${id.communityId}/channel/${id.channelId}`;
    }
}

export function chatIdentifierToString(chatId: ChatIdentifier): string {
    switch (chatId.kind) {
        case "direct_chat":
            return chatId.userId;
        case "group_chat":
            return chatId.groupId;
        case "channel":
            return `${chatId.communityId}_${chatId.channelId}`;
        default:
            throw new UnsupportedValueError("Unknown chatId kind", chatId);
    }
}

export function contentTypeToPermission(contentType: AttachmentContent["kind"]): MessagePermission {
    switch (contentType) {
        case "image_content":
            return "image";
        case "video_content":
            return "video";
        case "audio_content":
            return "audio";
        case "file_content":
            return "file";
        default:
            throw new UnsupportedValueError("Unknown attachment content type", contentType);
    }
}

export function mapAcceptP2PSwapResponseToStatus(
    response: AcceptP2PSwapResponse,
    userId: string,
): P2PSwapStatus {
    switch (response.kind) {
        case "success":
            return {
                kind: "p2p_swap_accepted",
                acceptedBy: userId,
                token1TxnIn: response.token1TxnIn,
            };
        case "already_reserved":
            return {
                kind: "p2p_swap_reserved",
                reservedBy: response.reservedBy,
            };
        case "already_accepted":
            return {
                kind: "p2p_swap_accepted",
                acceptedBy: response.acceptedBy,
                token1TxnIn: response.token1TxnIn,
            };
        case "already_completed":
            return {
                kind: "p2p_swap_completed",
                acceptedBy: response.acceptedBy,
                token1TxnIn: response.token1TxnIn,
                token0TxnOut: response.token0TxnOut,
                token1TxnOut: response.token1TxnOut,
            };
        case "swap_cancelled":
            return {
                kind: "p2p_swap_cancelled",
                token0TxnOut: response.token0TxnOut,
            };
        case "swap_expired":
            return {
                kind: "p2p_swap_expired",
                token0TxnOut: response.token0TxnOut,
            };
        default:
            return {
                kind: "p2p_swap_open",
            };
    }
}

export function mapCancelP2PSwapResponseToStatus(response: CancelP2PSwapResponse): P2PSwapStatus {
    switch (response.kind) {
        case "success":
            return {
                kind: "p2p_swap_cancelled",
            };
        case "already_reserved":
            return {
                kind: "p2p_swap_reserved",
                reservedBy: response.reservedBy,
            };
        case "already_accepted":
            return {
                kind: "p2p_swap_accepted",
                acceptedBy: response.acceptedBy,
                token1TxnIn: response.token1TxnIn,
            };
        case "already_completed":
            return {
                kind: "p2p_swap_completed",
                acceptedBy: response.acceptedBy,
                token1TxnIn: response.token1TxnIn,
                token0TxnOut: response.token0TxnOut,
                token1TxnOut: response.token1TxnOut,
            };
        case "swap_cancelled":
            return {
                kind: "p2p_swap_cancelled",
                token0TxnOut: response.token0TxnOut,
            };
        case "swap_expired":
            return {
                kind: "p2p_swap_expired",
                token0TxnOut: response.token0TxnOut,
            };
        default:
            return {
                kind: "p2p_swap_open",
            };
    }
}
