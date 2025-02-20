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
    if ("ac" in value) {
        return addedToChannelNotification(value.ac, timestamp);
    }
    if ("cm" in value) {
        return channelNotification(value.cm, timestamp);
    }
    if ("gm" in value) {
        return groupNotification(value.gm, timestamp);
    }
    if ("dm" in value) {
        return directNotification(value.dm, timestamp);
    }
    if ("cr" in value) {
        return channelReactionNotification(value.cr, timestamp);
    }
    if ("gr" in value) {
        return groupReactionNotification(value.gr, timestamp);
    }
    if ("dr" in value) {
        return directReactionNotification(value.dr, timestamp);
    }
    if ("ct" in value) {
        return channelMessageTipped(value.ct, timestamp);
    }
    if ("gt" in value) {
        return groupMessageTipped(value.gt, timestamp);
    }
    if ("dt" in value) {
        return directMessageTipped(value.dt, timestamp);
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
            communityId: principalBytesToString(value.ci),
            channelId: Number(toBigInt32(value.chi)),
        },
        communityName: value.cn,
        channelName: value.chn,
        addedBy: principalBytesToString(value.a),
        addedByUsername: value.an,
        addedByDisplayName: value.ad,
        communityAvatarId: value.ca,
        channelAvatarId: value.cha,
        timestamp,
    };
}

export function channelNotification(
    value: TChannelMessageNotification,
    timestamp: bigint,
): ChannelNotification {
    return {
        kind: "channel_notification",
        sender: principalBytesToString(value.s),
        threadRootMessageIndex: value.tr,
        messageIndex: value.m,
        messageEventIndex: value.e,
        senderName: value.sn,
        senderDisplayName: value.sd,
        chatId: {
            kind: "channel",
            communityId: principalBytesToString(value.ci),
            channelId: Number(toBigInt32(value.chi)),
        },
        communityName: value.cn,
        channelName: value.chn,
        messageType: value.ty,
        messageText: value.tx,
        imageUrl: value.i,
        communityAvatarId: value.ca,
        channelAvatarId: value.cha,
        cryptoTransfer: value.ct !== undefined
            ? cryptoTransfer(value.ct)
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
        sender: principalBytesToString(value.s),
        threadRootMessageIndex: value.tr,
        messageIndex: value.m,
        messageEventIndex: value.e,
        senderName: value.sn,
        senderDisplayName: value.sd,
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.c) },
        groupName: value.g,
        messageType: value.ty,
        messageText: value.tx,
        imageUrl: value.i,
        groupAvatarId: value.a,
        cryptoTransfer: value.ct !== undefined
            ? cryptoTransfer(value.ct)
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
        chatId: { kind: "direct_chat", userId: principalBytesToString(value.s) },
        messageIndex: value.m,
        messageEventIndex: value.e,
        username: value.sn,
        displayName: value.sd,
        messageType: value.ty,
        messageText: value.tx,
        imageUrl: value.i,
        userAvatarId: value.a,
        cryptoTransfer: value.ct !== undefined
            ? cryptoTransfer(value.ct)
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
            communityId: principalBytesToString(value.ci),
            channelId: Number(toBigInt32(value.chi)),
        },
        communityName: value.cn,
        channelName: value.chn,
        threadRootMessageIndex: value.tr,
        messageIndex: value.m,
        messageEventIndex: value.e,
        addedBy: principalBytesToString(value.a),
        addedByName: value.an,
        addedByDisplayName: value.ad,
        reaction: value.r,
        communityAvatarId: value.ca,
        channelAvatarId: value.cha,
        timestamp,
    };
}

function groupReactionNotification(
    value: TGroupReactionAddedNotification,
    timestamp: bigint,
): GroupReaction {
    return {
        kind: "group_reaction",
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.c) },
        threadRootMessageIndex: value.tr,
        messageIndex: value.m,
        messageEventIndex: value.e,
        groupName: value.g,
        addedBy: principalBytesToString(value.a),
        addedByName: value.n,
        addedByDisplayName: value.d,
        reaction: value.r,
        groupAvatarId: value.av,
        timestamp,
    };
}

function directReactionNotification(
    value: TDirectReactionAddedNotification,
    timestamp: bigint,
): DirectReaction {
    return {
        kind: "direct_reaction",
        chatId: { kind: "direct_chat", userId: principalBytesToString(value.t) },
        messageIndex: value.m,
        messageEventIndex: value.e,
        username: value.u,
        displayName: value.d,
        reaction: value.r,
        userAvatarId: value.a,
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
            communityId: principalBytesToString(value.ci),
            channelId: Number(toBigInt32(value.chi)),
        },
        communityName: value.cn,
        channelName: value.chn,
        threadRootMessageIndex: value.tr,
        messageIndex: value.m,
        messageEventIndex: value.e,
        tippedBy: principalBytesToString(value.ti),
        tippedByName: value.tn,
        tippedByDisplayName: value.td,
        tip: value.t,
        communityAvatarId: value.ca,
        channelAvatarId: value.cha,
        timestamp,
    };
}

function groupMessageTipped(
    value: TGroupMessageTipped,
    timestamp: bigint,
): GroupMessageTipped {
    return {
        kind: "group_message_tipped",
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.c) },
        threadRootMessageIndex: value.tr,
        messageIndex: value.m,
        messageEventIndex: value.e,
        groupName: value.g,
        tippedBy: principalBytesToString(value.ti),
        tippedByName: value.tn,
        tippedByDisplayName: value.td,
        tip: value.t,
        groupAvatarId: value.a,
        timestamp,
    };
}

function directMessageTipped(
    value: TDirectMessageTipped,
    timestamp: bigint,
): DirectMessageTipped {
    return {
        kind: "direct_message_tipped",
        chatId: { kind: "direct_chat", userId: principalBytesToString(value.ti) },
        messageIndex: value.m,
        messageEventIndex: value.e,
        username: value.u,
        displayName: value.d,
        tip: value.t,
        userAvatarId: value.a,
        timestamp,
    };
}

function cryptoTransfer(value: TCryptoTransferDetails): CryptoTransferDetails {
    return {
        recipient: principalBytesToString(value.r),
        recipientUsername: value.u,
        ledger: principalBytesToString(value.l),
        symbol: value.s,
        amount: value.a,
    };
}
