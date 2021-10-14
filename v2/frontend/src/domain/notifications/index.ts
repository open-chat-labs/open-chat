import type { Message } from "../chat/chat";

export type Notification = DirectNotification | GroupNotification;

export type DirectNotification = {
    kind: "direct_notification";
    sender: string;
    message: Message;
    senderName: string;
};

export type GroupNotification = {
    kind: "group_notification";
    sender: string;
    message: Message;
    senderName: string;
    chatId: string;
    groupName: string;
};

export type SubscriptionExistsResponse = boolean;

export type NotificationStatus =
    | "unsupported"
    | "prompt"
    | "soft-denied"
    | "hard-denied"
    | "granted";
