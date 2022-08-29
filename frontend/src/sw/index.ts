import { IDL } from "@dfinity/candid";
import { Buffer } from "buffer";
import type { ApiNotification } from "../services/notifications/candid/idl";
import { Notification as NotificationIdl } from "../services/notifications/candid/notification";
import type { CryptocurrencyContent, MessageContent } from "../domain/chat/chat";
import type { Notification } from "../domain/notifications";
import type { User } from "../domain/user/user";
import { UnsupportedValueError } from "../utils/error";
import { notification as toNotification } from "../services/notifications/mappers";
import { getSoftDisabled } from "../utils/caching";
import { toUint8Array } from "../utils/base64";
import { Cryptocurrency, E8S_PER_TOKEN } from "../domain/crypto";

export {};
declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", function (_event) {
    self.skipWaiting();
});

self.addEventListener("push", function (event: PushEvent) {
    event.waitUntil(handlePushNotification(event));
});

self.addEventListener("notificationclick", function (event: NotificationEvent) {
    event.waitUntil(handleNotificationClick(event));
});

self.addEventListener("fetch", () => {
    console.log("dummy fetch interceptor");
});

async function handlePushNotification(event: PushEvent): Promise<void> {
    if (!event.data) return;

    const bytes = toUint8Array(event.data.text());

    // Try to extract the typed notification from the event
    const candid = IDL.decode(
        [NotificationIdl],
        Buffer.from(bytes)
    )[0] as unknown as ApiNotification;
    if (!candid) {
        return;
    }

    const notification = toNotification(candid);

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
    if ((await getSoftDisabled()) || (await isClientFocused())) {
        return;
    }
    await showNotification(notification);
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
        const urlToOpen = new URL(self.location.origin).href + "#/" + event.notification.data.path;
        await self.clients.openWindow(urlToOpen);
    }
}

async function isClientFocused(): Promise<boolean> {
    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    return windowClients.some((wc) => wc.focused && wc.visibilityState === "visible");
}

async function showNotification(notification: Notification): Promise<void> {
    let icon = "/_/raw/icon.png";
    let title = "OpenChat - ";
    let body: string;
    let path: string;
    let timestamp: number;
    if (notification.kind === "direct_notification") {
        const content = extractMessageContent(
            notification.message.event.content,
            notification.senderName
        );
        title += notification.senderName;
        body = content.text;
        icon = content.image ?? icon;
        path = notification.sender;
        timestamp = Number(notification.message.timestamp);
    } else if (notification.kind === "group_notification") {
        const content = extractMessageContent(
            notification.message.event.content,
            notification.senderName,
            notification.mentioned
        );
        title += notification.groupName;
        body = `${notification.senderName}: ${content.text}`;
        icon = content.image ?? icon;
        path = notification.chatId;
        timestamp = Number(notification.message.timestamp);
    } else if (notification.kind === "added_to_group_notification") {
        // TODO Multi language support
        title += notification.groupName;
        body = `${notification.addedByUsername} added you to the group "${notification.groupName}"`;
        path = notification.chatId;
        timestamp = Number(notification.timestamp);
    } else {
        throw new UnsupportedValueError("Unexpected notification type received", notification);
    }

    // We need to close any exiting notifications for the same tag otherwise the new notification will not be shown
    const existing = await self.registration.getNotifications({
        tag: path,
    });
    existing.forEach((n) => n.close());

    await self.registration.showNotification(title, {
        body,
        icon,
        tag: path,
        timestamp,
        data: {
            path,
        },
    });
}

type ContentExtract = {
    text: string;
    image?: string;
};

function extractMessageContentFromCryptoContent(
    content: CryptocurrencyContent,
    senderName: string
): ContentExtract {
    if (content.transfer.kind === "completed" || content.transfer.kind === "pending") {
        return {
            text: `${senderName} sent ${
                Number(content.transfer.amountE8s) / E8S_PER_TOKEN
            } ${toSymbol(content.transfer.token)}`,
        };
    } else {
        return {
            text: `${senderName} sent a crypto transfer`,
        };
    }
}

function toSymbol(token: Cryptocurrency): string {
    return token.toUpperCase();
}

function extractMessageContent(
    content: MessageContent,
    senderName: string,
    mentioned: Array<User> = []
): ContentExtract {
    let result: ContentExtract;

    if (content.kind === "text_content") {
        result = {
            text: content.text,
        };
    } else if (content.kind === "image_content") {
        result = {
            text: content.caption ?? extractMediaType(content.mimeType),
            image: content.thumbnailData,
        };
    } else if (content.kind === "giphy_content") {
        result = {
            text: content.caption ?? "Gif message",
        };
    } else if (content.kind === "video_content") {
        result = {
            text: content.caption ?? extractMediaType(content.mimeType),
            image: content.thumbnailData,
        };
    } else if (content.kind === "audio_content") {
        result = {
            text: content.caption ?? extractMediaType(content.mimeType),
        };
    } else if (content.kind === "file_content") {
        result = {
            text: content.caption ?? content.mimeType,
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==",
        };
    } else if (content.kind === "crypto_content") {
        result = extractMessageContentFromCryptoContent(content, senderName);
    } else if (content.kind === "deleted_content") {
        result = {
            text: "TODO - deleted content",
        };
    } else if (content.kind === "placeholder_content") {
        result = {
            text: "TODO - placeholder content",
        };
    } else if (content.kind === "poll_content") {
        result = {
            text: content.config.text ?? "New poll",
        };
    } else if (content.kind === "proposal_content") {
        result = {
            text: content.proposal.title,
        };
    } else {
        throw new UnsupportedValueError(
            "Unexpected message content type received with notification",
            content
        );
    }

    if (mentioned.length > 0) {
        result.text = replaceMentions(result.text, mentioned);
    }

    return result;
}

function extractMediaType(mimeType: string): string {
    return mimeType.replace(/\/.*/, "");
}

function replaceMentions(text: string, mentioned: Array<User>): string {
    const usernameLookup = Object.fromEntries(mentioned.map((u) => [u.userId, u.username]));
    return text.replace(/@UserId\(([\d\w-]+)\)/g, (_match, p1) => {
        const username = usernameLookup[p1] ?? "Unknown";
        return `@${username}`;
    });
}
