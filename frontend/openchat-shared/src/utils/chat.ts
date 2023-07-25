import {
    ChatEvent,
    Metrics,
    ChatSummary,
    Cryptocurrency,
    cryptoLookup,
    EventWrapper,
    extractUserIdsFromMentions,
    IndexRange,
    MemberRole,
    MessageContent,
    UnsupportedValueError,
    ChatIdentifier,
    MessageContext,
    ChatListScope,
} from "../domain";
import type { MessageFormatter } from "./i18n";

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
                        getContentAsText(fakeFormatter, e.event.repliesTo.content)
                    ).forEach((id) => userIds.add(id));
                }
                if (e.event.content.kind === "reported_message_content") {
                    e.event.content.reports.forEach((r) => userIds.add(r.reportedBy));
                }
                extractUserIdsFromMentions(
                    getContentAsText(fakeFormatter, e.event.content)
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
            case "gate_updated":
                userIds.add(e.event.updatedBy);
                break;
            case "direct_chat_created":
            case "aggregate_common_events":
            case "chat_frozen":
            case "chat_unfrozen":
            case "empty":
            case "users_invited":
                break;
            default:
                console.warn("Unexpected ChatEvent type received", e.event);
        }
        return userIds;
    }, new Set<string>());
}

export function getContentAsText(formatter: MessageFormatter, content: MessageContent): string {
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
                values: { token: toSymbol(content.transfer.token) },
            }),
            content.caption
        );
    } else if (content.kind === "deleted_content") {
        text = "deleted message";
    } else if (content.kind === "placeholder_content") {
        text = "placeholder content";
    } else if (content.kind === "poll_content") {
        text = content.config.text ?? "poll";
    } else if (content.kind === "proposal_content") {
        text = content.proposal.title;
    } else if (content.kind === "giphy_content") {
        text = captionedContent(formatter("giphyMessage"), content.caption);
    } else if (content.kind === "prize_content") {
        text = captionedContent(formatter("prizeMessage"), content.caption);
    } else if (content.kind === "prize_winner_content") {
        text = "Prize winner message";
    } else if (content.kind === "message_reminder_content") {
        text = content.notes ?? "Message reminder";
    } else if (content.kind === "message_reminder_created_content") {
        text = content.notes ?? "Message reminder";
    } else if (content.kind === "custom_content") {
        if (content.subtype === "user_referral_card") {
            text = formatter("referralHeader");
        } else {
            text = "custom_content";
        }
    } else if (content.kind === "reported_message_content") {
        text = "reported message";
    } else {
        throw new UnsupportedValueError("Unrecognised content type", content);
    }
    return text.trim();
}

function toSymbol(token: Cryptocurrency): string {
    return cryptoLookup[token].symbol;
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
    let started = BigInt(0);
    switch (chat.kind) {
        case "direct_chat":
            started = chat.dateCreated;
            break;
        case "group_chat":
            started = chat.membership?.joined ?? started;
            break;
        case "channel":
            started = chat.membership?.joined ?? started;
            break;
    }

    return chat.latestMessage && chat.latestMessage.timestamp > started
        ? chat.latestMessage.timestamp
        : started;
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

export function eventIsVisible(ew: EventWrapper<ChatEvent>): boolean {
    return ew.event.kind !== "message_pinned" && ew.event.kind !== "message_unpinned";
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
    messageIndex: number
): string {
    return ctx.threadRootMessageIndex === undefined
        ? `${routeForMessageContext(scope, ctx)}/${messageIndex}`
        : `${routeForMessageContext(scope, ctx)}/${messageIndex}?open=true`;
}

export function routeForMessageContext(
    scope: ChatListScope["kind"],
    { chatId, threadRootMessageIndex }: MessageContext
): string {
    return threadRootMessageIndex === undefined
        ? routeForChatIdentifier(scope, chatId)
        : `${routeForChatIdentifier(scope, chatId)}/${threadRootMessageIndex}`;
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

export function tokenSymbol(token: Cryptocurrency): string {
    switch (token) {
        case "icp": return "ICP";
        case "chat": return "CHAT";
        case "ckbtc": return "ckBTC";
        case "sns1": return "SNS1";
        case "kinic": return "KINIC";
        case "hotornot": return "HOT";
    }
}
