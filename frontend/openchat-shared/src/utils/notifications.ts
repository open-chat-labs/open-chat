import type {
    ChannelNotification,
    DirectNotification,
    GroupNotification,
    Notification,
} from "../domain";

export type MessageNotification = DirectNotification | GroupNotification | ChannelNotification;

export function isMessageNotification(
    notification: Notification,
): notification is MessageNotification {
    return (
        notification.kind === "direct_notification" ||
        notification.kind === "group_notification" ||
        notification.kind === "channel_notification"
    );
}
