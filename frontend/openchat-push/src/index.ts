import { IDL } from "@dfinity/candid";
import { ApiNotification, NotificationIdl, notification as toNotification } from "openchat-agent";
import {
    Notification,
    CryptocurrencyContent,
    MessageContent,
    User,
    Cryptocurrency,
    E8S_PER_TOKEN,
    UnsupportedValueError,
} from "openchat-shared";

declare const self: ServiceWorkerGlobalScope;

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
    if (!event.data) return;

    const bytes = toUint8Array(event.data.text());

    // Try to extract the typed notification from the event
    const candid = IDL.decode([NotificationIdl], bytes.buffer)[0] as unknown as ApiNotification;
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
    const isClientFocused = windowClients.some((wc) => wc.visibilityState === "visible");
    if (isClientFocused) {
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
        const urlToOpen = `${new URL(self.location.origin)}${event.notification.data.path}`;
        console.debug("PUSH: notification clicked no open clients. Opening: ", urlToOpen);
        await self.clients.openWindow(urlToOpen);
    }
}

function toUint8Array(base64String: string): Uint8Array {
    return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

async function showNotification(notification: Notification): Promise<void> {
    let icon = "/_/raw/icon.png";
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
        const content = extractMessageContent(
            notification.message.event.content,
            notification.senderName
        );
        title = notification.senderName;
        body = content.text;
        icon = content.image ?? icon;
        path = `${notification.sender}/${notification.message.event.messageIndex}`;
        tag = notification.sender;
        timestamp = Number(notification.message.timestamp);
        closeExistingNotifications = true;
    } else if (notification.kind === "group_notification") {
        const content = extractMessageContent(
            notification.message.event.content,
            notification.senderName,
            notification.mentioned
        );
        title = notification.groupName;
        body = `${notification.senderName}: ${content.text}`;
        icon = content.image ?? icon;
        path =
            notification.threadRootMessageIndex !== undefined
                ? `${notification.chatId}/${notification.threadRootMessageIndex}/${notification.message.event.messageIndex}?open=true`
                : `${notification.chatId}/${notification.message.event.messageIndex}`;
        tag = notification.threadRootMessageIndex !== undefined ? path : notification.chatId;
        timestamp = Number(notification.message.timestamp);
        closeExistingNotifications = true;
    } else if (notification.kind === "direct_reaction") {
        title = notification.username;
        body = `${notification.username} reacted '${notification.reaction}' to your message`;
        path = `${notification.them}/${notification.message.event.messageIndex}`;
        tag = path;
        timestamp = Number(notification.timestamp);
    } else if (notification.kind === "group_reaction") {
        title = notification.groupName;
        body = `${notification.addedByName} reacted '${notification.reaction}' to your message`;
        path =
            notification.threadRootMessageIndex !== undefined
                ? `${notification.chatId}/${notification.threadRootMessageIndex}/${notification.message.event.messageIndex}?open=true`
                : `${notification.chatId}/${notification.message.event.messageIndex}`;
        tag = path;
        timestamp = Number(notification.timestamp);
    } else if (notification.kind === "added_to_group_notification") {
        // TODO Multi language support
        title = notification.groupName;
        body = `${notification.addedByUsername} added you to the group "${notification.groupName}"`;
        path = notification.chatId;
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
        tag,
        timestamp,
        data: {
            path,
            notification,
        },
    };

    console.debug("PUSH: about to show notification: ", toShow);

    await self.registration.showNotification(title, toShow);
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
    } else if (content.kind === "prize_content") {
        result = {
            text: content.caption ?? "Prize message",
        };
    } else if (content.kind === "prize_winner_content") {
        result = {
            text: "Prize winner message",
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
    } else if (content.kind === "message_reminder_content") {
        result = {
            text: content.notes ?? "Reminder",
        };
    } else if (content.kind === "message_reminder_created_content") {
        result = {
            text: content.notes ?? "Reminder",
        };
    } else if (content.kind === "custom_content") {
        result = {
            text: "Custom content",
        };
    } else if (content.kind === "reported_message_content") {
        result = {
            text: "Reported message",
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

type ContentExtract = {
    text: string;
    image?: string;
};
