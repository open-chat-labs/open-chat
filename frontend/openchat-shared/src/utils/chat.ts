import {
    ChatEvent,
    ChatMetrics,
    ChatSummary,
    Cryptocurrency,
    cryptoLookup,
    EventWrapper,
    extractUserIdsFromMentions,
    IndexRange,
    MemberRole,
    MessageContent,
    UnsupportedValueError,
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
                extractUserIdsFromMentions(
                    getContentAsText(fakeFormatter, e.event.content)
                ).forEach((id) => userIds.add(id));
                break;
            case "member_joined":
            case "member_left":
            case "member_assumes_super_admin":
            case "member_relinquishes_super_admin":
            case "member_dismissed_as_super_admin":
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
            case "ownership_transferred":
                userIds.add(e.event.oldOwner);
                break;
            case "message_pinned":
                userIds.add(e.event.pinnedBy);
                break;
            case "message_unpinned":
                userIds.add(e.event.unpinnedBy);
                break;
            case "events_ttl_updated":
                userIds.add(e.event.updatedBy);
                break;
            case "message_deleted":
            case "message_undeleted":
            case "message_edited":
            case "reaction_added":
            case "reaction_removed":
            case "poll_vote_registered":
            case "poll_vote_deleted":
                userIds.add(e.event.message.updatedBy);
                break;
            case "direct_chat_created":
            case "poll_ended":
            case "thread_updated":
            case "proposals_updated":
            case "aggregate_common_events":
            case "chat_frozen":
            case "chat_unfrozen":
                break;
            default:
                throw new UnsupportedValueError("Unexpected ChatEvent type received", e.event);
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
    const started = chat.kind === "direct_chat" ? chat.dateCreated : chat.joined;

    return chat.latestMessage && chat.latestMessage.timestamp > started
        ? chat.latestMessage.timestamp
        : started;
}

export function compareChats(a: ChatSummary, b: ChatSummary): number {
    return Number(getDisplayDate(b) - getDisplayDate(a));
}

export function emptyChatMetrics(): ChatMetrics {
    return {
        audioMessages: 0,
        cyclesMessages: 0,
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
    return (
        ew.event.kind !== "reaction_added" &&
        ew.event.kind !== "message_deleted" &&
        ew.event.kind !== "message_undeleted" &&
        ew.event.kind !== "message_edited" &&
        ew.event.kind !== "reaction_removed" &&
        ew.event.kind !== "message_pinned" &&
        ew.event.kind !== "message_unpinned" &&
        ew.event.kind !== "poll_vote_registered" &&
        ew.event.kind !== "poll_vote_deleted" &&
        ew.event.kind !== "poll_ended" &&
        ew.event.kind !== "thread_updated" &&
        ew.event.kind !== "proposals_updated"
    );
}

export function compareRoles(a: MemberRole, b: MemberRole): number {
    if (a === b) return 0;
    if (a === "owner") return 1;
    if (b === "owner") return -1;
    if (a === "admin") return 1;
    if (b === "admin") return -1;
    if (a === "participant") return 1;
    return -1;
}