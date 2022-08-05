import type { User } from "../../domain/user/user";
import type { EventWrapper, Message } from "../chat/chat";

export type Notification = AddedToGroupNotification | DirectNotification | GroupNotification;

export type AddedToGroupNotification = {
    kind: "added_to_group_notification";
    chatId: string;
    groupName: string;
    addedBy: string;
    addedByUsername: string;
};

export type DirectNotification = {
    kind: "direct_notification";
    sender: string;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
    senderName: string;
};

export type GroupNotification = {
    kind: "group_notification";
    sender: string;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
    senderName: string;
    chatId: string;
    groupName: string;
    mentioned: User[];
};

export type SubscriptionExistsResponse = boolean;

export type NotificationStatus =
    | "unsupported"
    | "prompt"
    | "soft-denied"
    | "hard-denied"
    | "granted";

export type ToggleMuteNotificationResponse = "success" | "chat_not_found";
