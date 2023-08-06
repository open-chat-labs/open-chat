import {
    SubscriptionExistsResponse,
    ToggleMuteNotificationResponse,
    UnsupportedValueError,
    Notification,
    AddedToChannelNotification,
    AddedToGroupNotification,
    ChannelNotification,
    GroupNotification,
    DirectNotification,
    ChannelReaction,
    GroupReaction,
    DirectReaction,
} from "openchat-shared";
import { identity, optional } from "../../utils/mapping";
import type {
    ApiMuteNotificationsResponse,
    ApiUnmuteNotificationsResponse,
} from "../user/candid/idl";
import type {
    ApiSubscriptionExistsResponse,
    ApiNotification,
    ApiAddedToChannelNotification,
    ApiAddedToGroupNotification,
    ApiChannelMessageNotification,
    ApiGroupMessageNotification,
    ApiDirectMessageNotification,
    ApiChannelReactionAddedNotification,
    ApiGroupReactionAddedNotification,
    ApiDirectReactionAddedNotification,
} from "./candid/idl";
import type { ApiToggleMuteChannelNotificationsResponse } from "../community/candid/idl";

export function muteNotificationsResponse(
    candid:
        | ApiMuteNotificationsResponse
        | ApiUnmuteNotificationsResponse
        | ApiToggleMuteChannelNotificationsResponse
): ToggleMuteNotificationResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("MuteNotification failed with: ", candid);
        return "failure";
    }
}

export function subscriptionExistsResponse(
    candid: ApiSubscriptionExistsResponse
): SubscriptionExistsResponse {
    if ("Yes" in candid) {
        return true;
    }
    if ("No" in candid) {
        return false;
    }
    throw new UnsupportedValueError(
        `Unexpected ApiSubscriptionExistsResponse type received`,
        candid
    );
}

export function notification(candid: ApiNotification, timestamp: bigint): Notification {
    if ("AddedToChannel" in candid) {
        return addedToChannelNotification(candid.AddedToChannel, timestamp);
    }
    if ("AddedToGroup" in candid) {
        return addedToGroupNotification(candid.AddedToGroup, timestamp);
    }
    if ("ChannelMessage" in candid) {
        return channelNotification(candid.ChannelMessage, timestamp);
    }
    if ("GroupMessage" in candid) {
        return groupNotification(candid.GroupMessage, timestamp);
    }
    if ("DirectMessage" in candid) {
        return directNotification(candid.DirectMessage, timestamp);
    }
    if ("ChannelReactionAdded" in candid) {
        return channelReactionNotification(candid.ChannelReactionAdded, timestamp);
    }
    if ("GroupReactionAdded" in candid) {
        return groupReactionNotification(candid.GroupReactionAdded, timestamp);
    }
    if ("DirectReactionAdded" in candid) {
        return directReactionNotification(candid.DirectReactionAdded, timestamp);
    }
    throw new Error(`Unexpected ApiNotification type received, ${candid}`);
}

export function addedToChannelNotification(
    candid: ApiAddedToChannelNotification,
    timestamp : bigint,
): AddedToChannelNotification {
    return {
        kind: "added_to_channel_notification",
        chatId: { kind: "channel", communityId: candid.community_id.toString(), channelId: candid.channel_id.toString() },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        addedBy: candid.added_by.toString(),
        addedByUsername: candid.added_by_name,
        timestamp,
    };
}

export function addedToGroupNotification(
    candid: ApiAddedToGroupNotification,
    timestamp : bigint,
): AddedToGroupNotification {
    return {
        kind: "added_to_group_notification",
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        groupName: candid.group_name,
        addedBy: candid.added_by.toString(),
        addedByUsername: candid.added_by_name,
        timestamp,
    };
}

export function channelNotification(
    candid: ApiChannelMessageNotification,
    timestamp : bigint,
): ChannelNotification {
    return {
        kind: "channel_notification",
        sender: candid.sender.toString(),
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        eventIndex: candid.event_index,
        senderName: candid.sender_name,
        chatId: { kind: "channel", communityId: candid.community_id.toString(), channelId: candid.channel_id.toString() },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        messageType: candid.message_type,
        messageText: optional(candid.message_text, identity),
        thumbnail: optional(candid.thumbnail, identity),
        timestamp,
    };
}

export function groupNotification(
    candid: ApiGroupMessageNotification,
    timestamp: bigint,
): GroupNotification {
    return {
        kind: "group_notification",
        sender: candid.sender.toString(),
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        eventIndex: candid.event_index,
        senderName: candid.sender_name,
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        groupName: candid.group_name,
        messageType: candid.message_type,
        messageText: optional(candid.message_text, identity),
        thumbnail: optional(candid.thumbnail, identity),
        timestamp,
    };
}

export function directNotification(
    candid: ApiDirectMessageNotification,
    timestamp: bigint,
): DirectNotification {
    return {
        kind: "direct_notification",
        sender: { kind: "direct_chat", userId: candid.sender.toString() },
        messageIndex: candid.message_index,
        eventIndex: candid.event_index,
        senderName: candid.sender_name,
        messageType: candid.message_type,
        messageText: optional(candid.message_text, identity),
        thumbnail: optional(candid.thumbnail, identity),
        timestamp,
    };
}

function channelReactionNotification(
    candid: ApiChannelReactionAddedNotification,
    timestamp: bigint,
): ChannelReaction {
    return {
        kind: "channel_reaction",
        chatId: { kind: "channel", communityId: candid.community_id.toString(), channelId: candid.channel_id.toString() },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        addedBy: candid.added_by.toString(),
        addedByName: candid.added_by_name,
        reaction: candid.reaction,
        timestamp,
    };
}

function groupReactionNotification(
    candid: ApiGroupReactionAddedNotification,
    timestamp: bigint,
): GroupReaction {
    return {
        kind: "group_reaction",
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        groupName: candid.group_name,
        addedBy: candid.added_by.toString(),
        addedByName: candid.added_by_name,
        reaction: candid.reaction,
        timestamp,
    };
}

function directReactionNotification(
    candid: ApiDirectReactionAddedNotification,
    timestamp: bigint,
): DirectReaction {
    return {
        kind: "direct_reaction",
        them: { kind: "direct_chat", userId: candid.them.toString() },
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        username: candid.username,
        reaction: candid.reaction,
        timestamp,
    };
}
