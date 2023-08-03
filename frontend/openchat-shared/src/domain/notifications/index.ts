import type { User } from "../../domain/user/user";
import type {
    ChannelIdentifier,
    DirectChatIdentifier,
    EventWrapper,
    GroupChatIdentifier,
    Message,
} from "../chat/chat";

export type Notification =
    | AddedToChannelNotification
    | AddedToGroupNotification
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

export type AddedToGroupNotification = {
    kind: "added_to_group_notification";
    chatId: GroupChatIdentifier;
    groupName: string;
    addedBy: string;
    addedByUsername: string;
    timestamp: bigint;
};

export type ChannelNotification = {
    kind: "channel_notification";
    chatId: ChannelIdentifier;
    sender: string;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
    senderName: string;
    communityName: string;
    channelName: string;
    mentioned: User[];
};

export type DirectNotification = {
    kind: "direct_notification";
    sender: DirectChatIdentifier;
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
    chatId: GroupChatIdentifier;
    groupName: string;
    mentioned: User[];
};

export type ChannelReaction = {
    kind: "channel_reaction";
    chatId: ChannelIdentifier;
    threadRootMessageIndex: number | undefined;
    communityName: string;
    channelName: string;
    addedBy: string;
    addedByName: string;
    message: EventWrapper<Message>;
    reaction: string;
    timestamp: bigint;
};

export type DirectReaction = {
    kind: "direct_reaction";
    them: DirectChatIdentifier;
    username: string;
    message: EventWrapper<Message>;
    reaction: string;
    timestamp: bigint;
};

export type GroupReaction = {
    kind: "group_reaction";
    chatId: GroupChatIdentifier;
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

export type ToggleMuteNotificationResponse = "success" | "failure";
