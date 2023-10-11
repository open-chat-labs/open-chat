import type {
    ChannelNotification,
    DirectNotification,
    GroupNotification,
    Notification,
} from "../domain";

export function isMessageNotification(
    notification: Notification,
): notification is DirectNotification | GroupNotification | ChannelNotification {
    return (
        notification.kind === "direct_notification" ||
        notification.kind === "group_notification" ||
        notification.kind === "channel_notification"
    );
}
