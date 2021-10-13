import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Notification,
    MessageContent,
    DirectMessageNotification,
    GroupMessageNotification,
    SubscriptionExistsResponse,
} from "./types";
export {
    _SERVICE as NotificationsService,
    Notification as ApiNotification,
    MessageContent as ApiMessageContent,
    DirectMessageNotification as ApiDirectMessageNotification,
    GroupMessageNotification as ApiGroupMessageNotification,
    SubscriptionExistsResponse as ApiSubscriptionExistsResponse,
};

export const idlFactory: IDL.InterfaceFactory;
