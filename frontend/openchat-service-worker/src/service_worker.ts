import {
    deserializeFromMsgPack,
    Notification as TNotification,
    notification as toNotification,
    typeboxValidate,
} from "openchat-agent";
import type {
    Notification,
    ChannelIdentifier,
    CryptoTransferDetails,
    DirectNotification,
    DirectReaction,
    DirectMessageTipped,
    GroupNotification,
    GroupReaction,
    GroupMessageTipped,
    ChannelNotification,
    ChannelReaction,
    ChannelMessageTipped,
    AddedToChannelNotification,
} from "openchat-shared";
import {
    UnsupportedValueError,
    isMessageNotification,
    routeForMessage,
    routeForMessageContext,
    routeForChatIdentifier,
    toTitleCase,
} from "openchat-shared";
import { ExpirationPlugin } from "workbox-expiration";
import { staticResourceCache } from "workbox-recipes";
import { CustomCachePlugin } from "./cache_plugin";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-expect-error
self.__WB_DISABLE_DEV_LOGS = true;

declare const self: ServiceWorkerGlobalScope;

const FILE_ICON =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==";

staticResourceCache({
    matchCallback: ({ request }) => {
        return [
            "style",
            "script",
            "worker",
            "audio",
            "font",
            "frame",
            "image",
            "manifest",
            "video",
        ].includes(request.destination);
    },
    cacheName: "openchat_stale_while_revalidate",
    plugins: [
        new CustomCachePlugin(),
        new ExpirationPlugin({
            maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
    ],
});

const matchCallback = ({ request }: { request: Request }) => request.mode === "navigate";
const networkTimeoutSeconds = 3;

registerRoute(
    matchCallback,
    new NetworkFirst({
        networkTimeoutSeconds,
        cacheName: "openchat_network_first",
        matchOptions: {
            ignoreVary: true,
            ignoreMethod: true,
            ignoreSearch: true,
        },
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
            {
                cacheKeyWillBeUsed: async () => "openchat_document",
            },
        ],
    }),
);

// Always install updated SW immediately
self.addEventListener("install", (ev) => {
    ev.waitUntil(self.skipWaiting().then(() => console.debug("SW: skipWaiting promise resolved")));
});

self.addEventListener("activate", (ev) => {
    // upon activation take control of all clients (tabs & windows)
    ev.waitUntil(self.clients.claim());
    console.debug("SW: activated");
});

self.addEventListener("push", (ev: PushEvent) => {
    ev.waitUntil(handlePushNotification(ev));
});

self.addEventListener("notificationclick", (ev: NotificationEvent) => {
    ev.waitUntil(handleNotificationClick(ev));
});

async function handlePushNotification(event: PushEvent): Promise<void> {
    const id = Date.now().toString();
    console.debug("SW: push notification received", id);
    if (!event.data) {
        console.debug("SW: notification data is empty", id);
        return;
    }

    const { t, v }: TimestampedNotification = JSON.parse(event.data.text());
    const [timestamp, value] = [t, v];

    const bytes = toUint8Array(value);

    const webPushNotification = decodeWebPushNotification(bytes, timestamp);
    if (webPushNotification === undefined) {
        console.debug("SW: unable to decode notification", id);
        return;
    }

    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    windowClients.forEach((window) => {
        window.postMessage({
            type: "NOTIFICATION_RECEIVED",
            data: webPushNotification,
        });
    });

    // If notifications are disabled or an OC browser window already has the focus then don't show a notification
    const isClientFocused = windowClients.some(
        (wc) => wc.focused && wc.visibilityState === "visible",
    );
    if (isClientFocused) {
        console.debug("SW: suppressing notification because client focused", id);
        return;
    }

    const [title, notification] = buildNotification(webPushNotification);

    console.debug("SW: about to show notification: ", notification, id);
    await self.registration.showNotification(title, notification);

    // Hack to make sure the notification is always displayed before this function returns in order to avoid
    // the generic "This site was updated in the background" notification from appearing
    await delay(100);
}

async function handleNotificationClick(event: NotificationEvent): Promise<void> {
    event.notification.close();

    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    if (windowClients.length > 0) {
        const window = windowClients[0];
        window.postMessage({
            type: "NOTIFICATION_CLICKED",
            path: event.notification.data.path,
        });
        await window.focus();
    } else {
        const urlToOpen = new URL(event.notification.data.path, self.location.origin);
        console.debug("SW: notification clicked no open clients. Opening: ", urlToOpen);
        await self.clients.openWindow(urlToOpen);
    }
}

function decodeWebPushNotification(bytes: Uint8Array, timestamp: bigint): Notification | undefined {
    try {
        const deserialized = deserializeFromMsgPack(bytes);
        const validated = typeboxValidate(deserialized, TNotification);
        return toNotification(validated, timestamp);
    }
    catch {
        // Failed to decode using MsgPack
    }
}

function toUint8Array(base64String: string): Uint8Array {
    return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

function buildNotification(n: Notification): [string, NotificationOptions] {
    let icon = "/_/raw/icon.png";
    let image = undefined;
    let title: string;
    let body: string;

    if (isDirectNotification(n)) {
        title = n.displayName ?? n.username;
        if (n.userAvatarId !== undefined) {
            icon = avatarUrl(n.chatId.userId, n.userAvatarId);
        }

        if (n.kind === "direct_notification") {
            body = messageText(n.messageText, n.messageType, n.cryptoTransfer);
            image = n.imageUrl;
        } else if (n.kind === "direct_reaction") {
            body = `${n.displayName ?? n.username} reacted '${n.reaction}' to your message`;
        } else {
            body = `${n.displayName ?? n.username} tipped your message ${n.tip}`;
        }
    } else if (isGroupNotification(n)) {
        title = n.groupName;
        if (n.groupAvatarId !== undefined) {
            icon = avatarUrl(n.chatId.groupId, n.groupAvatarId);
        }

        if (n.kind === "group_notification") {
            body = `${n.senderDisplayName ?? n.senderName}: ${messageText(
                n.messageText,
                n.messageType,
                n.cryptoTransfer,
            )}`;
            image = n.imageUrl;
        } else if (n.kind === "group_reaction") {
            body = `${n.addedByDisplayName ?? n.addedByName} reacted '${
                n.reaction
            }' to your message`;
        } else {
            body = `${n.tippedByDisplayName ?? n.tippedByName} tipped your message ${n.tip}`;
        }
    } else if (isChannelNotification(n)) {
        title = `${n.communityName} / ${n.channelName}`;
        if (n.channelAvatarId !== undefined) {
            icon = channelAvatarUrl(n.chatId, n.channelAvatarId);
        } else if (n.communityAvatarId !== undefined) {
            icon = avatarUrl(n.chatId.communityId, n.communityAvatarId);
        }

        if (n.kind === "channel_notification") {
            body = `${n.senderDisplayName ?? n.senderName}: ${messageText(
                n.messageText,
                n.messageType,
                n.cryptoTransfer,
            )}`;
            image = n.imageUrl;
        } else if (n.kind === "channel_reaction") {
            body = `${n.addedByDisplayName ?? n.addedByName} reacted '${
                n.reaction
            }' to your message`;
        } else if (n.kind === "channel_message_tipped") {
            body = `${n.tippedByDisplayName ?? n.tippedByName} tipped your message ${n.tip}`;
        } else {
            body = `${n.addedByDisplayName ?? n.addedByUsername} added you to the channel "${
                n.channelName
            }" in the community "${n.communityName}"`;
        }
    } else {
        throw new UnsupportedValueError("Unexpected notification type received", n);
    }

    const path = notificationPath(n);

    let tag: string | undefined = undefined;
    if (isMessageNotification(n)) {
        if (icon === undefined && n.messageType === "File") {
            icon = FILE_ICON;
        }
    } else {
        tag = path;
    }

    const notificationBody = {
        body,
        icon,
        image,
        renotify: tag !== undefined,
        tag,
        timestamp: Number(n.timestamp),
        data: {
            path,
            notification: n,
        },
    };

    return [title, notificationBody];
}

function messageText(
    messageText: string | undefined,
    messageType: string,
    cryptoTransfer: CryptoTransferDetails | undefined,
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
        case "poll":
            return "Created a poll";
        default: {
            return `${toTitleCase(messageType.replace("_", " "))} message`;
        }
    }
}

function notificationPath(n: Notification): string {
    switch (n.kind) {
        case "direct_notification":
            return routeForChatIdentifier("direct_chat", n.chatId);

        case "direct_reaction":
        case "direct_message_tipped":
            return routeForMessage("direct_chat", { chatId: n.chatId }, n.messageIndex);

        case "group_notification":
            return routeForMessageContext("group_chat", {
                chatId: n.chatId,
                threadRootMessageIndex: n.threadRootMessageIndex,
            });

        case "group_reaction":
        case "group_message_tipped":
            return routeForMessage(
                "group_chat",
                {
                    chatId: n.chatId,
                    threadRootMessageIndex: n.threadRootMessageIndex,
                },
                n.messageIndex,
            );

        case "channel_notification":
            return routeForMessageContext("community", {
                chatId: n.chatId,
                threadRootMessageIndex: n.threadRootMessageIndex,
            });

        case "channel_reaction":
        case "channel_message_tipped":
            return routeForMessage(
                "community",
                {
                    chatId: n.chatId,
                    threadRootMessageIndex: n.threadRootMessageIndex,
                },
                n.messageIndex,
            );

        case "added_to_channel_notification":
            return routeForChatIdentifier("none", n.chatId);
    }
}

function isDirectNotification(
    notification: Notification,
): notification is DirectNotification | DirectReaction | DirectMessageTipped {
    return (
        notification.kind === "direct_notification" ||
        notification.kind === "direct_reaction" ||
        notification.kind === "direct_message_tipped"
    );
}

function isGroupNotification(
    notification: Notification,
): notification is GroupNotification | GroupReaction | GroupMessageTipped {
    return (
        notification.kind === "group_notification" ||
        notification.kind === "group_reaction" ||
        notification.kind === "group_message_tipped"
    );
}

function isChannelNotification(
    notification: Notification,
): notification is
    | ChannelNotification
    | ChannelReaction
    | ChannelMessageTipped
    | AddedToChannelNotification {
    return (
        notification.kind === "channel_notification" ||
        notification.kind === "channel_reaction" ||
        notification.kind === "channel_message_tipped" ||
        notification.kind === "added_to_channel_notification"
    );
}

function avatarUrl(canisterId: string, avatarId: bigint): string {
    return `https://${canisterId}.raw.icp0.io/avatar/${avatarId}`;
}

function channelAvatarUrl(channel: ChannelIdentifier, avatarId: bigint): string {
    return `https://${channel.communityId}.raw.icp0.io/channel/${channel.channelId}/avatar/${avatarId}`;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

type TimestampedNotification = {
    t: bigint; // timestamp
    v: string; // value
};
