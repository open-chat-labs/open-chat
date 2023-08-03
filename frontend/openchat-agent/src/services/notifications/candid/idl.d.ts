import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Notification,
    MessageContent,
    AddedToChannelNotification,
    AddedToGroupNotification,
    ChannelMessageNotification,
    DirectMessageNotification,
    GroupMessageNotification,
    ChannelReactionAddedNotification,
    DirectReactionAddedNotification,
    GroupReactionAddedNotification,
    SubscriptionExistsResponse,
    User,
} from "./types";
export {
    _SERVICE as NotificationsService,
    Notification as ApiNotification,
    MessageContent as ApiMessageContent,
    AddedToChannelNotification as ApiAddedToChannelNotification,
    AddedToGroupNotification as ApiAddedToGroupNotification,
    ChannelMessageNotification as ApiChannelMessageNotification,
    DirectMessageNotification as ApiDirectMessageNotification,
    GroupMessageNotification as ApiGroupMessageNotification,
    ChannelReactionAddedNotification as ApiChannelReactionAddedNotification,
    DirectReactionAddedNotification as ApiDirectReactionAddedNotification,
    GroupReactionAddedNotification as ApiGroupReactionAddedNotification,
    SubscriptionExistsResponse as ApiSubscriptionExistsResponse,
    User as ApiUser,
};

export const idlFactory: IDL.InterfaceFactory;
