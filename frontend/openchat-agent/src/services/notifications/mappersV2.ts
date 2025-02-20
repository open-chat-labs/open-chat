import {
    AddedToChannelNotification as TAddedToChannelNotification,
    ChannelMessageNotification as TChannelMessageNotification,
    ChannelMessageTipped as TChannelMessageTipped,
    ChannelReactionAddedNotification as TChannelReactionAddedNotification,
    CryptoTransferDetails as TCryptoTransferDetails,
    DirectMessageNotification as TDirectMessageNotification,
    DirectMessageTipped as TDirectMessageTipped,
    DirectReactionAddedNotification as TDirectReactionAddedNotification,
    GroupMessageNotification as TGroupMessageNotification,
    GroupMessageTipped as TGroupMessageTipped,
    GroupReactionAddedNotification as TGroupReactionAddedNotification,
    Notification as TNotification
} from "../../typebox";
import type {
    Notification,
    AddedToChannelNotification,
    ChannelNotification,
    GroupNotification,
    DirectNotification,
    ChannelReaction,
    GroupReaction,
    DirectReaction,
    ChannelMessageTipped,
    GroupMessageTipped,
    DirectMessageTipped,
    CryptoTransferDetails,
} from "openchat-shared";
import { toBigInt32 } from "openchat-shared";
import { principalBytesToString } from "../../utils/mapping";

export function notification(value: TNotification, timestamp: bigint): Notification {
    if ("AddedToChannel" in value) {
        return addedToChannelNotification(value.AddedToChannel, timestamp);
    }
    if ("ChannelMessage" in value) {
        return channelNotification(value.ChannelMessage, timestamp);
    }
    if ("GroupMessage" in value) {
        return groupNotification(value.GroupMessage, timestamp);
    }
    if ("DirectMessage" in value) {
        return directNotification(value.DirectMessage, timestamp);
    }
    if ("ChannelReactionAdded" in value) {
        return channelReactionNotification(value.ChannelReactionAdded, timestamp);
    }
    if ("GroupReactionAdded" in value) {
        return groupReactionNotification(value.GroupReactionAdded, timestamp);
    }
    if ("DirectReactionAdded" in value) {
        return directReactionNotification(value.DirectReactionAdded, timestamp);
    }
    if ("ChannelMessageTipped" in value) {
        return channelMessageTipped(value.ChannelMessageTipped, timestamp);
    }
    if ("GroupMessageTipped" in value) {
        return groupMessageTipped(value.GroupMessageTipped, timestamp);
    }
    if ("DirectMessageTipped" in value) {
        return directMessageTipped(value.DirectMessageTipped, timestamp);
    }
    throw new Error(`Unexpected ApiNotification type received, ${value}`);
}

export function addedToChannelNotification(
    value: TAddedToChannelNotification,
    timestamp: bigint,
): AddedToChannelNotification {
    return {
        kind: "added_to_channel_notification",
        chatId: {
            kind: "channel",
            communityId: principalBytesToString(value.community_id),
            channelId: Number(toBigInt32(value.channel_id)),
        },
        communityName: value.community_name,
        channelName: value.channel_name,
        addedBy: principalBytesToString(value.added_by),
        addedByUsername: value.added_by_name,
        addedByDisplayName: value.added_by_display_name,
        communityAvatarId: value.community_avatar_id,
        channelAvatarId: value.channel_avatar_id,
        timestamp,
    };
}

export function channelNotification(
    value: TChannelMessageNotification,
    timestamp: bigint,
): ChannelNotification {
    return {
        kind: "channel_notification",
        sender: principalBytesToString(value.sender),
        threadRootMessageIndex: value.thread_root_message_index,
        messageIndex: value.message_index,
        messageEventIndex: value.event_index,
        senderName: value.sender_name,
        senderDisplayName: value.sender_display_name,
        chatId: {
            kind: "channel",
            communityId: principalBytesToString(value.community_id),
            channelId: Number(toBigInt32(value.channel_id)),
        },
        communityName: value.community_name,
        channelName: value.channel_name,
        messageType: value.message_type,
        messageText: value.message_text,
        imageUrl: value.image_url,
        communityAvatarId: value.community_avatar_id,
        channelAvatarId: value.channel_avatar_id,
        cryptoTransfer: value.crypto_transfer !== undefined
            ? cryptoTransfer(value.crypto_transfer)
            : undefined,
        timestamp,
    };
}

export function groupNotification(
    value: TGroupMessageNotification,
    timestamp: bigint,
): GroupNotification {
    return {
        kind: "group_notification",
        sender: principalBytesToString(value.sender),
        threadRootMessageIndex: value.thread_root_message_index,
        messageIndex: value.message_index,
        messageEventIndex: value.event_index,
        senderName: value.sender_name,
        senderDisplayName: value.sender_display_name,
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.chat_id) },
        groupName: value.group_name,
        messageType: value.message_type,
        messageText: value.message_text,
        imageUrl: value.image_url,
        groupAvatarId: value.group_avatar_id,
        cryptoTransfer: value.crypto_transfer !== undefined
            ? cryptoTransfer(value.crypto_transfer)
            : undefined,
        timestamp,
    };
}

export function directNotification(
    value: TDirectMessageNotification,
    timestamp: bigint,
): DirectNotification {
    return {
        kind: "direct_notification",
        chatId: { kind: "direct_chat", userId: principalBytesToString(value.sender) },
        messageIndex: value.message_index,
        messageEventIndex: value.event_index,
        username: value.sender_name,
        displayName: value.sender_display_name,
        messageType: value.message_type,
        messageText: value.message_text,
        imageUrl: value.image_url,
        userAvatarId: value.sender_avatar_id,
        cryptoTransfer: value.crypto_transfer !== undefined
            ? cryptoTransfer(value.crypto_transfer)
            : undefined,
        timestamp,
    };
}

function channelReactionNotification(
    value: TChannelReactionAddedNotification,
    timestamp: bigint,
): ChannelReaction {
    return {
        kind: "channel_reaction",
        chatId: {
            kind: "channel",
            communityId: principalBytesToString(value.community_id),
            channelId: Number(toBigInt32(value.channel_id)),
        },
        communityName: value.community_name,
        channelName: value.channel_name,
        threadRootMessageIndex: value.thread_root_message_index,
        messageIndex: value.message_index,
        messageEventIndex: value.message_event_index,
        addedBy: principalBytesToString(value.added_by),
        addedByName: value.added_by_name,
        addedByDisplayName: value.added_by_display_name,
        reaction: value.reaction,
        communityAvatarId: value.community_avatar_id,
        channelAvatarId: value.channel_avatar_id,
        timestamp,
    };
}

function groupReactionNotification(
    value: TGroupReactionAddedNotification,
    timestamp: bigint,
): GroupReaction {
    return {
        kind: "group_reaction",
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.chat_id) },
        threadRootMessageIndex: value.thread_root_message_index,
        messageIndex: value.message_index,
        messageEventIndex: value.message_event_index,
        groupName: value.group_name,
        addedBy: principalBytesToString(value.added_by),
        addedByName: value.added_by_name,
        addedByDisplayName: value.added_by_display_name,
        reaction: value.reaction,
        groupAvatarId: value.group_avatar_id,
        timestamp,
    };
}

function directReactionNotification(
    value: TDirectReactionAddedNotification,
    timestamp: bigint,
): DirectReaction {
    return {
        kind: "direct_reaction",
        chatId: { kind: "direct_chat", userId: principalBytesToString(value.them) },
        messageIndex: value.message_index,
        messageEventIndex: value.message_event_index,
        username: value.username,
        displayName: value.display_name,
        reaction: value.reaction,
        userAvatarId: value.user_avatar_id,
        timestamp,
    };
}

function channelMessageTipped(
    value: TChannelMessageTipped,
    timestamp: bigint,
): ChannelMessageTipped {
    return {
        kind: "channel_message_tipped",
        chatId: {
            kind: "channel",
            communityId: principalBytesToString(value.community_id),
            channelId: Number(toBigInt32(value.channel_id)),
        },
        communityName: value.community_name,
        channelName: value.channel_name,
        threadRootMessageIndex: value.thread_root_message_index,
        messageIndex: value.message_index,
        messageEventIndex: value.message_event_index,
        tippedBy: principalBytesToString(value.tipped_by),
        tippedByName: value.tipped_by_name,
        tippedByDisplayName: value.tipped_by_display_name,
        tip: value.tip,
        communityAvatarId: value.community_avatar_id,
        channelAvatarId: value.channel_avatar_id,
        timestamp,
    };
}

function groupMessageTipped(
    value: TGroupMessageTipped,
    timestamp: bigint,
): GroupMessageTipped {
    return {
        kind: "group_message_tipped",
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.chat_id) },
        threadRootMessageIndex: value.thread_root_message_index,
        messageIndex: value.message_index,
        messageEventIndex: value.message_event_index,
        groupName: value.group_name,
        tippedBy: principalBytesToString(value.tipped_by),
        tippedByName: value.tipped_by_name,
        tippedByDisplayName: value.tipped_by_display_name,
        tip: value.tip,
        groupAvatarId: value.group_avatar_id,
        timestamp,
    };
}

function directMessageTipped(
    value: TDirectMessageTipped,
    timestamp: bigint,
): DirectMessageTipped {
    return {
        kind: "direct_message_tipped",
        chatId: { kind: "direct_chat", userId: principalBytesToString(value.them) },
        messageIndex: value.message_index,
        messageEventIndex: value.message_event_index,
        username: value.username,
        displayName: value.display_name,
        tip: value.tip,
        userAvatarId: value.user_avatar_id,
        timestamp,
    };
}

function cryptoTransfer(value: TCryptoTransferDetails): CryptoTransferDetails {
    return {
        recipient: principalBytesToString(value.recipient),
        recipientUsername: value.recipient_username,
        ledger: principalBytesToString(value.ledger),
        symbol: value.symbol,
        amount: value.amount,
    };
}
