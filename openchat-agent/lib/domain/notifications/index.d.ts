import type { User } from "../../domain/user/user";
import type { EventWrapper, Message } from "../chat/chat";
export declare type Notification = AddedToGroupNotification | DirectNotification | GroupNotification | DirectReaction | GroupReaction;
export declare type AddedToGroupNotification = {
    kind: "added_to_group_notification";
    chatId: string;
    groupName: string;
    addedBy: string;
    addedByUsername: string;
    timestamp: bigint;
};
export declare type DirectNotification = {
    kind: "direct_notification";
    sender: string;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
    senderName: string;
};
export declare type GroupNotification = {
    kind: "group_notification";
    sender: string;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
    senderName: string;
    chatId: string;
    groupName: string;
    mentioned: User[];
};
export declare type DirectReaction = {
    kind: "direct_reaction";
    them: string;
    username: string;
    message: EventWrapper<Message>;
    reaction: string;
    timestamp: bigint;
};
export declare type GroupReaction = {
    kind: "group_reaction";
    chatId: string;
    threadRootMessageIndex: number | undefined;
    groupName: string;
    addedBy: string;
    addedByName: string;
    message: EventWrapper<Message>;
    reaction: string;
    timestamp: bigint;
};
export declare type SubscriptionExistsResponse = boolean;
export declare type NotificationStatus = "pending-init" | "unsupported" | "prompt" | "soft-denied" | "hard-denied" | "granted";
export declare type ToggleMuteNotificationResponse = "success" | "chat_not_found" | "internal_error";
