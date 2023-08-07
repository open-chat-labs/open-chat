import type {
    ChannelIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
} from "../chat/chat";

export type Notification =
    | AddedToChannelNotification
    | ChannelNotification
    | DirectNotification
    | GroupNotification
    | ChannelReaction
    | DirectReaction
    | GroupReaction;

export type AddedToChannelNotification = {
    kind: "added_to_channel_notification";
    chatId: ChannelIdentifier;
    communityName: string;
    channelName: string;
    addedBy: string;
    addedByUsername: string;
    timestamp: bigint;
};

export type ChannelNotification = {
    kind: "channel_notification";
    chatId: ChannelIdentifier;
    sender: string;
    threadRootMessageIndex: number | undefined;
    messageIndex: number;
    eventIndex: number;
    senderName: string;
    communityName: string;
    channelName: string;
    messageType: string;
    messageText: string | undefined;
    imageUrl: string | undefined;
    timestamp: bigint;
};

export type DirectNotification = {
    kind: "direct_notification";
    sender: DirectChatIdentifier;
    messageIndex: number;
    eventIndex: number;
    senderName: string;
    messageType: string;
    messageText: string | undefined;
    imageUrl: string | undefined;
    timestamp: bigint;
};

export type GroupNotification = {
    kind: "group_notification";
    sender: string;
    threadRootMessageIndex: number | undefined;
    messageIndex: number;
    eventIndex: number;
    senderName: string;
    chatId: GroupChatIdentifier;
    groupName: string;
    messageType: string;
    messageText: string | undefined;
    imageUrl: string | undefined;
    timestamp: bigint;
};

export type ChannelReaction = {
    kind: "channel_reaction";
    chatId: ChannelIdentifier;
    threadRootMessageIndex: number | undefined;
    messageIndex: number;
    messageEventIndex: number;
    communityName: string;
    channelName: string;
    addedBy: string;
    addedByName: string;
    reaction: string;
    timestamp: bigint;
};

export type DirectReaction = {
    kind: "direct_reaction";
    messageIndex: number;
    messageEventIndex: number;
    them: DirectChatIdentifier;
    username: string;
    reaction: string;
    timestamp: bigint;
};

export type GroupReaction = {
    kind: "group_reaction";
    chatId: GroupChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageIndex: number;
    messageEventIndex: number;
    groupName: string;
    addedBy: string;
    addedByName: string;
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

export type ToggleMuteNotificationResponse = "success" | "failure";
