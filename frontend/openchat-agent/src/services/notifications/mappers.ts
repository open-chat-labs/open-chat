import type {
    SubscriptionExistsResponse,
    ToggleMuteNotificationResponse,
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
import { identity, optional } from "../../utils/mapping";
import type {
    ApiMuteNotificationsResponse,
    ApiUnmuteNotificationsResponse,
} from "../user/candid/idl";
import type {
    ApiNotification,
    ApiAddedToChannelNotification,
    ApiChannelMessageNotification,
    ApiGroupMessageNotification,
    ApiDirectMessageNotification,
    ApiChannelReactionAddedNotification,
    ApiGroupReactionAddedNotification,
    ApiDirectReactionAddedNotification,
    ApiChannelMessageTippedNotification,
    ApiGroupMessageTippedNotification,
    ApiDirectMessageTippedNotification,
    ApiNotificationCryptoTransferDetails,
} from "./candid/idl";
import type {
    CommunityToggleMuteNotificationsResponse,
    GroupToggleMuteNotificationsResponse,
    NotificationsIndexSubscriptionExistsResponse,
    UserMuteNotificationsResponse,
} from "../../typebox";

export function muteNotificationsResponse(
    candid: ApiMuteNotificationsResponse | ApiUnmuteNotificationsResponse,
): ToggleMuteNotificationResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("MuteNotification failed with: ", candid);
        return "failure";
    }
}

export function toggleNotificationsResponse(
    value:
        | UserMuteNotificationsResponse
        | GroupToggleMuteNotificationsResponse
        | CommunityToggleMuteNotificationsResponse,
): ToggleMuteNotificationResponse {
    if (typeof value === "object" && "Success" in value) {
        return "success";
    } else {
        console.warn("MuteNotification failed with: ", value);
        return "failure";
    }
}

export function subscriptionExistsResponse(
    value: NotificationsIndexSubscriptionExistsResponse,
): SubscriptionExistsResponse {
    return value === "Yes";
}

export function notification(candid: ApiNotification, timestamp: bigint): Notification {
    if ("AddedToChannel" in candid) {
        return addedToChannelNotification(candid.AddedToChannel, timestamp);
    }
    if ("ChannelMessage" in candid) {
        return channelNotification(candid.ChannelMessage, timestamp);
    }
    if ("GroupMessage" in candid) {
        return groupNotification(candid.GroupMessage, timestamp);
    }
    if ("DirectMessage" in candid) {
        return directNotification(candid.DirectMessage, timestamp);
    }
    if ("ChannelReactionAdded" in candid) {
        return channelReactionNotification(candid.ChannelReactionAdded, timestamp);
    }
    if ("GroupReactionAdded" in candid) {
        return groupReactionNotification(candid.GroupReactionAdded, timestamp);
    }
    if ("DirectReactionAdded" in candid) {
        return directReactionNotification(candid.DirectReactionAdded, timestamp);
    }
    if ("ChannelMessageTipped" in candid) {
        return channelMessageTipped(candid.ChannelMessageTipped, timestamp);
    }
    if ("GroupMessageTipped" in candid) {
        return groupMessageTipped(candid.GroupMessageTipped, timestamp);
    }
    if ("DirectMessageTipped" in candid) {
        return directMessageTipped(candid.DirectMessageTipped, timestamp);
    }
    throw new Error(`Unexpected ApiNotification type received, ${candid}`);
}

export function addedToChannelNotification(
    candid: ApiAddedToChannelNotification,
    timestamp: bigint,
): AddedToChannelNotification {
    return {
        kind: "added_to_channel_notification",
        chatId: {
            kind: "channel",
            communityId: candid.community_id.toString(),
            channelId: candid.channel_id.toString(),
        },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        addedBy: candid.added_by.toString(),
        addedByUsername: candid.added_by_name,
        addedByDisplayName: optional(candid.added_by_display_name, identity),
        communityAvatarId: optional(candid.community_avatar_id, identity),
        channelAvatarId: optional(candid.channel_avatar_id, identity),
        timestamp,
    };
}

export function channelNotification(
    candid: ApiChannelMessageNotification,
    timestamp: bigint,
): ChannelNotification {
    return {
        kind: "channel_notification",
        sender: candid.sender.toString(),
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.event_index,
        senderName: candid.sender_name,
        senderDisplayName: optional(candid.sender_display_name, identity),
        chatId: {
            kind: "channel",
            communityId: candid.community_id.toString(),
            channelId: candid.channel_id.toString(),
        },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        messageType: candid.message_type,
        messageText: optional(candid.message_text, identity),
        imageUrl: optional(candid.image_url, identity),
        communityAvatarId: optional(candid.community_avatar_id, identity),
        channelAvatarId: optional(candid.channel_avatar_id, identity),
        cryptoTransfer: optional(candid.crypto_transfer, cryptoTransfer),
        timestamp,
    };
}

export function groupNotification(
    candid: ApiGroupMessageNotification,
    timestamp: bigint,
): GroupNotification {
    return {
        kind: "group_notification",
        sender: candid.sender.toString(),
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.event_index,
        senderName: candid.sender_name,
        senderDisplayName: optional(candid.sender_display_name, identity),
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        groupName: candid.group_name,
        messageType: candid.message_type,
        messageText: optional(candid.message_text, identity),
        imageUrl: optional(candid.image_url, identity),
        groupAvatarId: optional(candid.group_avatar_id, identity),
        cryptoTransfer: optional(candid.crypto_transfer, cryptoTransfer),
        timestamp,
    };
}

export function directNotification(
    candid: ApiDirectMessageNotification,
    timestamp: bigint,
): DirectNotification {
    return {
        kind: "direct_notification",
        chatId: { kind: "direct_chat", userId: candid.sender.toString() },
        messageIndex: candid.message_index,
        messageEventIndex: candid.event_index,
        username: candid.sender_name,
        displayName: optional(candid.sender_display_name, identity),
        messageType: candid.message_type,
        messageText: optional(candid.message_text, identity),
        imageUrl: optional(candid.image_url, identity),
        userAvatarId: optional(candid.sender_avatar_id, identity),
        cryptoTransfer: optional(candid.crypto_transfer, cryptoTransfer),
        timestamp,
    };
}

function channelReactionNotification(
    candid: ApiChannelReactionAddedNotification,
    timestamp: bigint,
): ChannelReaction {
    return {
        kind: "channel_reaction",
        chatId: {
            kind: "channel",
            communityId: candid.community_id.toString(),
            channelId: candid.channel_id.toString(),
        },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        addedBy: candid.added_by.toString(),
        addedByName: candid.added_by_name,
        addedByDisplayName: optional(candid.added_by_display_name, identity),
        reaction: candid.reaction,
        communityAvatarId: optional(candid.community_avatar_id, identity),
        channelAvatarId: optional(candid.channel_avatar_id, identity),
        timestamp,
    };
}

function groupReactionNotification(
    candid: ApiGroupReactionAddedNotification,
    timestamp: bigint,
): GroupReaction {
    return {
        kind: "group_reaction",
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        groupName: candid.group_name,
        addedBy: candid.added_by.toString(),
        addedByName: candid.added_by_name,
        addedByDisplayName: optional(candid.added_by_display_name, identity),
        reaction: candid.reaction,
        groupAvatarId: optional(candid.group_avatar_id, identity),
        timestamp,
    };
}

function directReactionNotification(
    candid: ApiDirectReactionAddedNotification,
    timestamp: bigint,
): DirectReaction {
    return {
        kind: "direct_reaction",
        chatId: { kind: "direct_chat", userId: candid.them.toString() },
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        username: candid.username,
        displayName: optional(candid.display_name, identity),
        reaction: candid.reaction,
        userAvatarId: optional(candid.user_avatar_id, identity),
        timestamp,
    };
}

function channelMessageTipped(
    candid: ApiChannelMessageTippedNotification,
    timestamp: bigint,
): ChannelMessageTipped {
    return {
        kind: "channel_message_tipped",
        chatId: {
            kind: "channel",
            communityId: candid.community_id.toString(),
            channelId: candid.channel_id.toString(),
        },
        communityName: candid.community_name,
        channelName: candid.channel_name,
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        tippedBy: candid.tipped_by.toString(),
        tippedByName: candid.tipped_by_name,
        tippedByDisplayName: optional(candid.tipped_by_display_name, identity),
        tip: candid.tip,
        communityAvatarId: optional(candid.community_avatar_id, identity),
        channelAvatarId: optional(candid.channel_avatar_id, identity),
        timestamp,
    };
}

function groupMessageTipped(
    candid: ApiGroupMessageTippedNotification,
    timestamp: bigint,
): GroupMessageTipped {
    return {
        kind: "group_message_tipped",
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        threadRootMessageIndex: optional(candid.thread_root_message_index, identity),
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        groupName: candid.group_name,
        tippedBy: candid.tipped_by.toString(),
        tippedByName: candid.tipped_by_name,
        tippedByDisplayName: optional(candid.tipped_by_display_name, identity),
        tip: candid.tip,
        groupAvatarId: optional(candid.group_avatar_id, identity),
        timestamp,
    };
}

function directMessageTipped(
    candid: ApiDirectMessageTippedNotification,
    timestamp: bigint,
): DirectMessageTipped {
    return {
        kind: "direct_message_tipped",
        chatId: { kind: "direct_chat", userId: candid.them.toString() },
        messageIndex: candid.message_index,
        messageEventIndex: candid.message_event_index,
        username: candid.username,
        displayName: optional(candid.display_name, identity),
        tip: candid.tip,
        userAvatarId: optional(candid.user_avatar_id, identity),
        timestamp,
    };
}

function cryptoTransfer(candid: ApiNotificationCryptoTransferDetails): CryptoTransferDetails {
    return {
        recipient: candid.recipient.toString(),
        recipientUsername: optional(candid.recipient_username, identity),
        ledger: candid.ledger.toString(),
        symbol: candid.symbol,
        amount: candid.amount,
    };
}
