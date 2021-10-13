import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Notification,
    MessageContent,
    DirectMessageNotification,
    GroupMessageNotification,
} from "./types";
export {
    _SERVICE as NotificationsService,
    Notification as ApiNotification,
    MessageContent as ApiMessageContent,
    DirectMessageNotification as ApiDirectMessageNotification,
    GroupMessageNotification as ApiGroupMessageNotification,
};

export const idlFactory: IDL.InterfaceFactory;
