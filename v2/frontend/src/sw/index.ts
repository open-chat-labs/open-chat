import type { ApiNotification } from "../services/notifications/candid/idl";
import type { MessageContent } from "../domain/chat/chat";
import type { Notification } from "../domain/notifications";
import { UnsupportedValueError } from "../utils/error";
import { notification } from "../services/notifications/mappers";
import { getSoftDisabled } from "../utils/caching";

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
    if (await getSoftDisabled()) return;

    // Try to extract the typed notification from the event
    const candid = event.data?.json() as ApiNotification;
    if (!candid) {
        return;
    }

    // If an OC browser window already has the focus then don't show a notification
    if (await isClientFocused()) {
        return;
    }
    await showNotification(notification(candid));
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
            chatId: event.notification.data.chatId,
            messageId: event.notification.data.messageId,
        });
    } else {
        const urlToOpen = new URL(self.location.origin).href + event.notification.data.chatId;
        await self.clients.openWindow(urlToOpen);
    }
}

async function isClientFocused(): Promise<boolean> {
    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    return windowClients.some((wc) => wc.focused);
}

async function showNotification(notification: Notification): Promise<void> {
    let icon = "/_/raw/icon.png";
    let title = "OpenChat - ";
    let body: string;
    let sender: string;
    let messageId: bigint;
    let chatId = "";
    if (notification.kind === "direct_notification") {
        const content = extractMessageContent(notification.message.content);
        title += notification.senderName;
        body = content.text;
        icon = content.image ?? icon;
        sender = notification.sender;
        chatId = notification.sender;
        messageId = notification.message.messageId;
    } else if (notification.kind === "group_notification") {
        const content = extractMessageContent(notification.message.content);
        title += notification.groupName;
        body = `${notification.senderName}: ${content.text}`;
        icon = content.image ?? icon;
        sender = notification.sender;
        chatId = notification.chatId;
        messageId = notification.message.messageId;
    } else {
        console.log("Unexpected notification type");
        return;
    }

    await self.registration.showNotification(title, {
        body,
        icon,
        tag: chatId,
        data: {
            chatId,
            sender,
            messageId,
        },
    });
}

type ContentExtract = {
    text: string;
    image?: string;
};

function extractMessageContent(content: MessageContent): ContentExtract {
    if (content.kind === "text_content") {
        return {
            text: content.text,
        };
    } else if (content.kind === "image_content") {
        return {
            text: content.caption ?? extractMediaType(content.mimeType),
            image: content.thumbnailData,
        };
    } else if (content.kind === "video_content") {
        return {
            text: content.caption ?? extractMediaType(content.mimeType),
            image: content.thumbnailData,
        };
    } else if (content.kind === "audio_content") {
        return {
            text: content.caption ?? extractMediaType(content.mimeType),
        };
    } else if (content.kind === "file_content") {
        return {
            text: content.caption ?? content.mimeType,
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==",
        };
    } else if (content.kind === "crypto_content") {
        return {
            text: "TODO - crypto content",
        };
    } else if (content.kind === "deleted_content") {
        return {
            text: "TODO - deleted content",
        };
    } else if (content.kind === "placeholder_content") {
        return {
            text: "TODO - placeholder content",
        };
    }
    throw new UnsupportedValueError(
        "Unexpected message content type received with notification",
        content
    );
}

function extractMediaType(mimeType: string): string {
    return mimeType.replace(/\/.*/, "");
}
