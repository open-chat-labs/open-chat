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

export function muteNotificationsResponse(
    candid: ApiMuteNotificationsResponse | ApiUnmuteNotificationsResponse
): ToggleMuteNotificationResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
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
    };
}

export function groupNotification(candid: ApiGroupMessageNotification): GroupNotification {
    return {
        kind: "group_notification",
        sender: candid.sender.toString(),
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        senderName: candid.sender_name,
        chatId: candid.chat_id.toString(),
        groupName: candid.group_name,
    };
}

export function directNotification(candid: ApiDirectMessageNotification): DirectNotification {
    return {
        kind: "direct_notification",
        sender: candid.sender.toString(),
        message: {
            index: candid.message.index,
            timestamp: candid.message.timestamp,
            event: message(candid.message.event),
        },
        senderName: candid.sender_name,
    };
}
