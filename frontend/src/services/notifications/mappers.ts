import type {
    AddedToGroupNotification,
    DirectNotification,
    GroupNotification,
    Notification,
    SubscriptionExistsResponse,
    ToggleMuteNotificationResponse,
} from "../../domain/notifications";
import { UnsupportedValueError } from "../../utils/error";
import { message } from "../common/chatMappers";
import type {
    ApiMuteNotificationsResponse,
    ApiUnmuteNotificationsResponse,
} from "../user/candid/idl";
import type {
    ApiAddedToGroupNotification,
    ApiDirectMessageNotification,
    ApiGroupMessageNotification,
    ApiNotification,
    ApiSubscriptionExistsResponse,
} from "./candid/idl";
import { identity, optional } from "utils/mapping";

export function muteNotificationsResponse(
    candid: ApiMuteNotificationsResponse | ApiUnmuteNotificationsResponse
): ToggleMuteNotificationResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        `Unexpected ApiToggleMuteNotificationsResponse type received`,
        candid
    );
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
    throw new Error(`Unexpected ApiNotification type received, ${candid}`);
}

export function addedToGroupNotification(
    candid: ApiAddedToGroupNotification
): AddedToGroupNotification {
    return {
        kind: "added_to_group_notification",
        chatId: candid.chat_id.toString(),
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
        chatId: candid.chat_id.toString(),
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
        sender: candid.sender.toString(),
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        senderName: candid.sender_name,
    };
}
