import type { User } from "../../domain/user/user";
import type { ChatIdentifier, EventWrapper, Message } from "../chat/chat";

export type Notification =
    | AddedToGroupNotification
    | DirectNotification
    | GroupNotification
    | DirectReaction
    | GroupReaction;

export type AddedToGroupNotification = {
    kind: "added_to_group_notification";
    chatId: ChatIdentifier;
    groupName: string;
    addedBy: string;
    addedByUsername: string;
    timestamp: bigint;
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
    chatId: ChatIdentifier;
    groupName: string;
    mentioned: User[];
};

export type DirectReaction = {
    kind: "direct_reaction";
    them: string;
    username: string;
    message: EventWrapper<Message>;
    reaction: string;
    timestamp: bigint;
};

export type GroupReaction = {
    kind: "group_reaction";
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    groupName: string;
    addedBy: string;
    addedByName: string;
    message: EventWrapper<Message>;
    reaction: string;
    timestamp: bigint;
};

export type SubscriptionExistsResponse = boolean;

export type NotificationStatus =
    | "pending-init"
    | "unsupported"
    | "prompt"
    | "soft-denied"
    | "hard-denied"
    | "granted";

export type ToggleMuteNotificationResponse = "success" | "chat_not_found" | "internal_error";
