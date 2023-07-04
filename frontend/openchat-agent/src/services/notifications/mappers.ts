import {
    SubscriptionExistsResponse,
    ToggleMuteNotificationResponse,
    UnsupportedValueError,
    Notification,
    AddedToGroupNotification,
    GroupNotification,
    DirectNotification,
    GroupReaction,
    DirectReaction,
} from "openchat-shared";
import { identity, optional } from "../../utils/mapping";
import { message } from "../common/chatMappers";
import type {
    ApiMuteNotificationsResponse,
    ApiUnmuteNotificationsResponse,
} from "../user/candid/idl";
import type {
    ApiSubscriptionExistsResponse,
    ApiNotification,
    ApiAddedToGroupNotification,
    ApiGroupMessageNotification,
    ApiDirectMessageNotification,
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

export function notification(candid: ApiNotification): Notification {
    if ("AddedToGroupNotification" in candid) {
        return addedToGroupNotification(candid.AddedToGroupNotification);
    }
    if ("GroupMessageNotification" in candid) {
        return groupNotification(candid.GroupMessageNotification);
    }
    if ("DirectMessageNotification" in candid) {
        return directNotification(candid.DirectMessageNotification);
    }
    if ("GroupReactionAddedNotification" in candid) {
        return groupReactionNotification(candid.GroupReactionAddedNotification);
    }
    if ("DirectReactionAddedNotification" in candid) {
        return directReactionNotification(candid.DirectReactionAddedNotification);
    }
    throw new Error(`Unexpected ApiNotification type received, ${candid}`);
}

export function addedToGroupNotification(
    candid: ApiAddedToGroupNotification
): AddedToGroupNotification {
    return {
        kind: "added_to_group_notification",
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        groupName: candid.group_name,
        addedBy: candid.added_by.toString(),
        addedByUsername: candid.added_by_name,
        timestamp: candid.timestamp,
    };
}

export function groupNotification(candid: ApiGroupMessageNotification): GroupNotification {
    return {
        kind: "group_notification",
        sender: candid.sender.toString(),
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        senderName: candid.sender_name,
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        groupName: candid.group_name,
        mentioned: candid.mentioned.map((m) => ({
            userId: m.user_id.toText(),
            username: m.username,
        })),
    };
}

export function directNotification(candid: ApiDirectMessageNotification): DirectNotification {
    return {
        kind: "direct_notification",
        sender: { kind: "direct_chat", userId: candid.sender.toString() },
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        senderName: candid.sender_name,
    };
}

function groupReactionNotification(candid: ApiGroupReactionAddedNotification): GroupReaction {
    return {
        kind: "group_reaction",
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        groupName: candid.group_name,
        addedBy: candid.added_by.toString(),
        addedByName: candid.added_by_name,
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        reaction: candid.reaction,
        timestamp: candid.timestamp,
    };
}

function directReactionNotification(candid: ApiDirectReactionAddedNotification): DirectReaction {
    return {
        kind: "direct_reaction",
        them: { kind: "direct_chat", userId: candid.them.toString() },
        username: candid.username,
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        reaction: candid.reaction,
        timestamp: candid.timestamp,
    };
}
