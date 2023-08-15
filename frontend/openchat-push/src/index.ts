import { IDL } from "@dfinity/candid";
import { ApiNotification, NotificationIdl, notification as toNotification } from "openchat-agent";
import type {
    Notification,
    DirectChatIdentifier,
    ChannelIdentifier,
    CryptoTransferDetails,
} from "openchat-shared";
import {
    UnsupportedValueError,
    routeForMessage,
    routeForChatIdentifier,
    toTitleCase,
} from "openchat-shared";

declare const self: ServiceWorkerGlobalScope;

const FILE_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==";

// Always install updated SW immediately
self.addEventListener("install", (ev) => {
    ev.waitUntil(self.skipWaiting().then(() => console.debug("PSW: skipWaiting promise resolved")));
});

self.addEventListener("activate", (ev) => {
    // upon activation take control of all clients (tabs & windows)
    ev.waitUntil(self.clients.claim());
    console.debug("PSW: actived");
});

self.addEventListener("fetch", () => {
    console.debug("PSW: dummy fetch interceptor");
});

self.addEventListener("push", (ev: PushEvent) => {
    ev.waitUntil(handlePushNotification(ev));
});

self.addEventListener("notificationclick", (ev: NotificationEvent) => {
    ev.waitUntil(handleNotificationClick(ev));
});

async function handlePushNotification(event: PushEvent): Promise<void> {
    const id = Date.now().toString();
    console.debug("PUSH: push notification received", id);
    if (!event.data) {
        console.debug("PUSH: notification data is empty", id);
        return;
    }

    const { t, v }: TimestampedNotification = JSON.parse(event.data.text());
    const [timestamp, value] = [t, v];

    const bytes = toUint8Array(value);

    // Try to extract the typed notification from the event
    const candid = IDL.decode([NotificationIdl], bytes.buffer)[0] as unknown as ApiNotification;
    if (!candid) {
        console.debug("PUSH: unable to decode candid", id);
        return;
    }

    const notification = toNotification(candid, timestamp);

    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    windowClients.forEach((window) => {
        window.postMessage({
            type: "NOTIFICATION_RECEIVED",
            data: notification,
        });
    });

    // If notifications are disabled or an OC browser window already has the focus then don't show a notification
    const isClientFocused = windowClients.some(
        (wc) => wc.focused && wc.visibilityState === "visible"
    );
    if (isClientFocused && isMessageNotification(notification)) {
        console.debug("PUSH: suppressing notification because client focused", id);
        return;
    }
    await showNotification(notification, id);
}

async function handleNotificationClick(event: NotificationEvent): Promise<void> {
    event.notification.close();

    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    if (windowClients.length > 0) {
        const window = windowClients[0];
        window.focus();

        window.postMessage({
            type: "NOTIFICATION_CLICKED",
            path: event.notification.data.path,
        });
    } else {
        const urlToOpen = new URL(event.notification.data.path, self.location.origin);
        console.debug("PUSH: notification clicked no open clients. Opening: ", urlToOpen);
        await self.clients.openWindow(urlToOpen);
    }
}

function toUint8Array(base64String: string): Uint8Array {
    return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

async function showNotification(notification: Notification, id: string): Promise<void> {
    let icon = "/_/raw/icon.png";
    let image = undefined;
    let title: string;
    let body: string;
    let path: string;
    let tag: string;
    let timestamp: number;

    // If true, we close existing notifications where the `path` matches, this ensures this new notification will
    // trigger an alert. If false, and there is already at least one notification with a matching path, then this new
    // notification will be silent
    let closeExistingNotifications = false;
    if (notification.kind === "direct_notification") {
        const chatId: DirectChatIdentifier = {
            kind: "direct_chat",
            userId: notification.sender.userId,
        };
        title = notification.senderName;
        body = messageText(notification.messageText, notification.messageType, notification.cryptoTransfer);
        if (notification.senderAvatarId !== undefined) {
            icon = avatarUrl(notification.sender.userId, notification.senderAvatarId);
        } else if (notification.messageType === "File") {
            icon = FILE_ICON;
        }
        image = notification.imageUrl;
        path = routeForMessage("direct_chat", { chatId }, notification.messageIndex);
        tag = notification.sender.userId;
        timestamp = Number(notification.timestamp);
        closeExistingNotifications = true;
    } else if (notification.kind === "group_notification") {
        title = notification.groupName;
        body = `${notification.senderName}: ${messageText(notification.messageText, notification.messageType, notification.cryptoTransfer)}`;
        if (notification.groupAvatarId !== undefined) {
            icon = avatarUrl(notification.chatId.groupId, notification.groupAvatarId);
        } else if (notification.messageType === "File") {
            icon = FILE_ICON;
        }
        image = notification.imageUrl;
        path = routeForMessage(
            "group_chat",
            {
                chatId: notification.chatId,
                threadRootMessageIndex: notification.threadRootMessageIndex,
            },
            notification.messageIndex
        );
        tag = notification.chatId.groupId;
        if (notification.threadRootMessageIndex !== undefined) {
            tag += `_${notification.threadRootMessageIndex}`;
        }
        timestamp = Number(notification.timestamp);
        closeExistingNotifications = true;
    } else if (notification.kind === "channel_notification") {
        title = `${notification.communityName} / ${notification.channelName}`;
        body = `${notification.senderName}: ${messageText(notification.messageText, notification.messageType, notification.cryptoTransfer)}`;
        if (notification.channelAvatarId !== undefined) {
            icon = channelAvatarUrl(notification.chatId, notification.channelAvatarId);
        } else if (notification.communityAvatarId !== undefined) {
            icon = avatarUrl(notification.chatId.communityId, notification.communityAvatarId);
        } else if (notification.messageType === "File") {
            icon = FILE_ICON;
        }
        image = notification.imageUrl;
        path = routeForMessage(
            "community",
            {
                chatId: notification.chatId,
                threadRootMessageIndex: notification.threadRootMessageIndex,
            },
            notification.messageIndex
        );
        tag = `${notification.chatId.communityId}_${notification.chatId.channelId}}`;
        if (notification.threadRootMessageIndex !== undefined) {
            tag += `_${notification.threadRootMessageIndex}`;
        }
        timestamp = Number(notification.timestamp);
        closeExistingNotifications = true;
    } else if (notification.kind === "direct_reaction") {
        title = notification.username;
        body = `${notification.username} reacted '${notification.reaction}' to your message`;
        if (notification.userAvatarId !== undefined) {
            icon = avatarUrl(notification.them.userId, notification.userAvatarId);
        }
        path = routeForMessage(
            "direct_chat",
            { chatId: notification.them },
            notification.messageIndex
        );
        tag = path;
        timestamp = Number(notification.timestamp);
    } else if (notification.kind === "channel_reaction") {
        title = `${notification.communityName} / ${notification.channelName}`;
        body = `${notification.addedByName} reacted '${notification.reaction}' to your message`;
        if (notification.channelAvatarId !== undefined) {
            icon = channelAvatarUrl(notification.chatId, notification.channelAvatarId);
        } else if (notification.communityAvatarId !== undefined) {
            icon = avatarUrl(notification.chatId.communityId, notification.communityAvatarId);
        }
        path = routeForMessage(
            "community",
            {
                chatId: notification.chatId,
                threadRootMessageIndex: notification.threadRootMessageIndex,
            },
            notification.messageIndex
        );
        tag = path;
        timestamp = Number(notification.timestamp);
    } else if (notification.kind === "group_reaction") {
        title = notification.groupName;
        body = `${notification.addedByName} reacted '${notification.reaction}' to your message`;
        if (notification.groupAvatarId !== undefined) {
            icon = avatarUrl(notification.chatId.groupId, notification.groupAvatarId);
        }
        path = routeForMessage(
            "group_chat",
            {
                chatId: notification.chatId,
                threadRootMessageIndex: notification.threadRootMessageIndex,
            },
            notification.messageIndex
        );
        tag = path;
        timestamp = Number(notification.timestamp);
    } else if (notification.kind === "added_to_channel_notification") {
        // TODO Multi language support
        title = `${notification.communityName} / ${notification.channelName}`;
        body = `${notification.addedByUsername} added you to the channel "${notification.channelName}" in the community "${notification.communityName}"`;
        if (notification.channelAvatarId !== undefined) {
            icon = channelAvatarUrl(notification.chatId, notification.channelAvatarId);
        } else if (notification.communityAvatarId !== undefined) {
            icon = avatarUrl(notification.chatId.communityId, notification.communityAvatarId);
        }
        path = routeForChatIdentifier("none", notification.chatId);
        tag = path;
        timestamp = Number(notification.timestamp);
    } else {
        throw new UnsupportedValueError("Unexpected notification type received", notification);
    }

    if (closeExistingNotifications) {
        // We need to close any existing notifications for the same tag otherwise the new notification will not be shown
        const existing = await self.registration.getNotifications({ tag });
        existing.forEach((n) => n.close());
    }

    const toShow = {
        body,
        icon,
        image,
        tag,
        timestamp,
        data: {
            path,
            notification,
        },
    };

    console.debug("PUSH: about to show notification: ", toShow, id);

    await self.registration.showNotification(title, toShow);
}

function messageText(
    messageText: string | undefined,
    messageType: string,
    cryptoTransfer: CryptoTransferDetails | undefined
): string {
    if (messageText !== undefined && messageText.length > 0) {
        return messageText;
    }

    if (cryptoTransfer !== undefined) {
        return `Sent ${Number(cryptoTransfer.amount) / Math.pow(10, 8)} ${cryptoTransfer.symbol}`;
    }

    return defaultMessage(messageType);
}

function defaultMessage(messageType: string): string {
    const messageTypeLower = messageType.toLowerCase();
    switch (messageTypeLower) {
        case "poll": return "Created a poll";
        default: {
            return `${toTitleCase(messageType)} message`;
        }
    }
}

function isMessageNotification(notification: Notification): boolean {
    return (
        notification.kind === "channel_notification" ||
        notification.kind === "direct_notification" ||
        notification.kind === "group_notification"
    );
}

function avatarUrl(canisterId: string, avatarId: bigint): string {
    return `https://${canisterId}.raw.icp0.io/avatar/${avatarId}`
}

function channelAvatarUrl(channel: ChannelIdentifier, avatarId: bigint): string {
    return `https://${channel.communityId}.raw.icp0.io/channel/${channel.channelId}/avatar/${avatarId}`
}

type TimestampedNotification = {
    t: bigint; // timestamp
    v: string; // value
}
