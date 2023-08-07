import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Notification,
    AddedToChannelNotification,
    ChannelMessageNotification,
    DirectMessageNotification,
    GroupMessageNotification,
    ChannelReactionAddedNotification,
    DirectReactionAddedNotification,
    GroupReactionAddedNotification,
    NotificationCryptoTransferDetails,
    SubscriptionExistsResponse,
} from "./types";
export {
    _SERVICE as NotificationsService,
    Notification as ApiNotification,
    AddedToChannelNotification as ApiAddedToChannelNotification,
    ChannelMessageNotification as ApiChannelMessageNotification,
    DirectMessageNotification as ApiDirectMessageNotification,
    GroupMessageNotification as ApiGroupMessageNotification,
    ChannelReactionAddedNotification as ApiChannelReactionAddedNotification,
    DirectReactionAddedNotification as ApiDirectReactionAddedNotification,
    GroupReactionAddedNotification as ApiGroupReactionAddedNotification,
    NotificationCryptoTransferDetails as ApiNotificationCryptoTransferDetails,
    SubscriptionExistsResponse as ApiSubscriptionExistsResponse,
};

export const idlFactory: IDL.InterfaceFactory;
