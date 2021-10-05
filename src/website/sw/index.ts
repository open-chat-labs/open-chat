import { Notification, V1MessageContent } from "../services/notifications/candid/types";
import * as cycleFunctions from "../utils/cycleFunctions";

declare var self: ServiceWorkerGlobalScope;
export {};

self.addEventListener('install', function(_event) {
    self.skipWaiting();
});

self.addEventListener('push', function(event: PushEvent) {
    event.waitUntil(handlePushNotification(event));
});

self.addEventListener('notificationclick', function(event: NotificationEvent) {
    event.waitUntil(handleNotificationClick(event));
});

self.addEventListener('fetch', () => {});

async function handlePushNotification(event: PushEvent) : Promise<void> {
    // Try to extract the typed notification from the event
    const notification = event.data?.json() as Notification;
    if (!notification) {
        return;
    }

    // If an OC browser window already has the focus then don't show a notification
    if (await isClientFocused()) {
        return;
    }    

    await showNotification(notification);
}

async function handleNotificationClick(event: NotificationEvent) : Promise<void> {
    event.notification.close();  

    let windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    });

    if (windowClients.length > 0) {
        let window = windowClients[0];
        window.focus();

        window.postMessage({
            type: "NOTIFICATION_CLICKED",
            chatId: event.notification.data.chatId,
            messageId: event.notification.data.messageId,
        });
    } else {
        const urlToOpen = new URL(self.location.origin).href + toHex(event.notification.data.chatId);
        await self.clients.openWindow(urlToOpen);
    }
}

async function isClientFocused() : Promise<boolean> {    
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    return windowClients.some((wc) => wc.focused);
}

async function showNotification(notificationVariant: Notification) : Promise<void> {
    let icon = "/_/raw/icon.png";
    let title = "OpenChat - ";
    let body: string;
    let sender: string;
    let messageId: number;
    let chatId: bigint;
    if ("V1DirectMessageNotification" in notificationVariant) {
        let notification = notificationVariant.V1DirectMessageNotification;
        let content = extractContent(notification.message.content);
        title += notification.sender_name;
        body = content.text;
        icon = content.image ?? icon;
        sender = notification.sender.toString();
        chatId = fromHex(notification.chat_id);
        messageId = notification.message.id;
    } else if ("V1GroupMessageNotification" in notificationVariant) {
        let notification = notificationVariant.V1GroupMessageNotification;
        let content = extractContent(notification.message.content);
        title += notification.group_name;
        body = `${notification.sender_name}: ${content.text}`;
        icon = content.image ?? icon;
        sender = notification.sender.toString();
        chatId = fromHex(notification.chat_id);
        messageId = notification.message.id;
    } else {
        console.log("Unexpected notification type");
        console.log(notificationVariant);
        return;
    }

    await self.registration.showNotification(title, {
        body, 
        icon, 
        tag: toHex(chatId),
        //renotify: (typeof tag !== "undefined"),
        data: {
            chatId,
            sender,
            messageId,           
        }
    });
}

type ContentExtract = {
    text: string;
    image?: string;
}

function extractContent(contentVariant: V1MessageContent) : ContentExtract {
    if ("Text" in contentVariant) {
        return {
            text: contentVariant.Text.text
        };
    } else if ("Media" in contentVariant) {
        let media = contentVariant.Media;
        return {
            text: (media.caption as unknown as string) ?? extractMediaType(media.mime_type),
            image: media.thumbnail_data,
        }
    } else if ("File" in contentVariant) {
        let file = contentVariant.File;
        return {
            text: (file.caption as unknown as string) ?? file.mime_type,
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==",
        }
    } else if ("Cycles" in contentVariant) {
        let cycles = contentVariant.Cycles;
        return {
            text: (cycles.caption as unknown as string) ?? `sent you ${cycleFunctions.toT(cycles.amount)}T cycles!`,
        }
    }
}

function extractMediaType(mimeType: string) : string {
    return mimeType.replace(/\/.*/, "");
}

function toHex(n: bigint) : string {
    return BigInt(n).toString(16).padStart(32, "0");
}

function fromHex(hex: string) : bigint {
    return BigInt("0x" + hex);
}
