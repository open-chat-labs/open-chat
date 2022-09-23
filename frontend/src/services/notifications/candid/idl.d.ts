import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Notification,
    MessageContent,
    AddedToGroupNotification,
    DirectMessageNotification,
    GroupMessageNotification,
    DirectReactionAddedNotification,
    GroupReactionAddedNotification,
    SubscriptionExistsResponse,
    User,
} from "./types";
export {
    _SERVICE as NotificationsService,
    Notification as ApiNotification,
    MessageContent as ApiMessageContent,
    AddedToGroupNotification as ApiAddedToGroupNotification,
    DirectMessageNotification as ApiDirectMessageNotification,
    GroupMessageNotification as ApiGroupMessageNotification,
    DirectReactionAddedNotification as ApiDirectReactionAddedNotification,
    GroupReactionAddedNotification as ApiGroupReactionAddedNotification,
    SubscriptionExistsResponse as ApiSubscriptionExistsResponse,
    User as ApiUser,
};

export const idlFactory: IDL.InterfaceFactory;
