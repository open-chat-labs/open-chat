import type { ChannelIdentifier, DirectChatIdentifier, GroupChatIdentifier } from "../chat/chat";
import type { OCError } from "../error";
import type { Offline, Success } from "../response";

export type Notification =
    | AddedToChannelNotification
    | ChannelNotification
    | DirectNotification
    | GroupNotification
    | ChannelReaction
    | DirectReaction
    | GroupReaction
    | ChannelMessageTipped
    | DirectMessageTipped
    | GroupMessageTipped;

export type AddedToChannelNotification = {
    kind: "added_to_channel_notification";
    chatId: ChannelIdentifier;
    communityName: string;
    channelName: string;
    addedBy: string;
    addedByUsername: string;
    addedByDisplayName: string | undefined;
    communityAvatarId: bigint | undefined;
    channelAvatarId: bigint | undefined;
    timestamp: bigint;
};

export type ChannelNotification = ChannelNotificationCommon & {
    kind: "channel_notification";
    sender: string;
    senderName: string;
    senderDisplayName: string | undefined;
    messageType: string;
    messageText: string | undefined;
    imageUrl: string | undefined;
    cryptoTransfer: CryptoTransferDetails | undefined;
};

export type DirectNotification = DirectNotificationCommon & {
    kind: "direct_notification";
    messageType: string;
    messageText: string | undefined;
    imageUrl: string | undefined;
    cryptoTransfer: CryptoTransferDetails | undefined;
};

export type GroupNotification = GroupNotificationCommon & {
    kind: "group_notification";
    sender: string;
    senderName: string;
    senderDisplayName: string | undefined;
    messageType: string;
    messageText: string | undefined;
    imageUrl: string | undefined;
    cryptoTransfer: CryptoTransferDetails | undefined;
};

export type ChannelReaction = ChannelNotificationCommon & {
    kind: "channel_reaction";
    addedBy: string;
    addedByName: string;
    addedByDisplayName: string | undefined;
    reaction: string;
};

export type DirectReaction = DirectNotificationCommon & {
    kind: "direct_reaction";
    reaction: string;
};

export type GroupReaction = GroupNotificationCommon & {
    kind: "group_reaction";
    addedBy: string;
    addedByName: string;
    addedByDisplayName: string | undefined;
    reaction: string;
};

export type ChannelMessageTipped = ChannelNotificationCommon & {
    kind: "channel_message_tipped";
    tippedBy: string;
    tippedByName: string;
    tippedByDisplayName: string | undefined;
    tip: string;
};

export type DirectMessageTipped = DirectNotificationCommon & {
    kind: "direct_message_tipped";
    tip: string;
};

export type GroupMessageTipped = GroupNotificationCommon & {
    kind: "group_message_tipped";
    tippedBy: string;
    tippedByName: string;
    tippedByDisplayName: string | undefined;
    tip: string;
};

export type DirectNotificationCommon = {
    chatId: DirectChatIdentifier;
    messageIndex: number;
    messageEventIndex: number;
    username: string;
    displayName: string | undefined;
    userAvatarId: bigint | undefined;
    timestamp: bigint;
};

export type GroupNotificationCommon = {
    chatId: GroupChatIdentifier;
    groupName: string;
    threadRootMessageIndex: number | undefined;
    messageIndex: number;
    messageEventIndex: number;
    groupAvatarId: bigint | undefined;
    timestamp: bigint;
};

export type ChannelNotificationCommon = {
    chatId: ChannelIdentifier;
    threadRootMessageIndex: number | undefined;
    messageIndex: number;
    messageEventIndex: number;
    communityName: string;
    channelName: string;
    communityAvatarId: bigint | undefined;
    channelAvatarId: bigint | undefined;
    timestamp: bigint;
};

export type CryptoTransferDetails = {
    recipient: string;
    recipientUsername: string | undefined;
    ledger: string;
    symbol: string;
    amount: bigint;
};

export type SubscriptionExistsResponse = boolean;

export type NotificationStatus =
    | "pending-init"
    | "unsupported"
    | "prompt"
    | "soft-denied"
    | "hard-denied"
    | "granted";

export type ToggleMuteNotificationResponse = Success | OCError | Offline;
