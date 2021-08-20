import { Notification, V1MessageContent } from "../services/notifications/candid/types";
import * as cycleFunctions from "../utils/cycleFunctions";

declare var self: ServiceWorkerGlobalScope;
export {};

self.addEventListener('push', function(event: PushEvent) {
    console.log(event.data?.json());
    const notifications = event.data?.json() as Notification[];
    if (!notifications) {
        return;
    }

    event.waitUntil(showNotifications(notifications, event.timeStamp));
});

async function showNotifications(notifications: Notification[], _timestamp: number) : Promise<void> {
    for (let notificationVariant of notifications) {
        let title = "OpenChat - ";
        let body: string;
        let icon: undefined | string;
        if ("V1DirectMessageNotification" in notificationVariant) {
            let notification = notificationVariant.V1DirectMessageNotification;
            let content = extractContent(notification.message.content);
            title += notification.sender_name;
            body = content.text;
            icon = content.image;
        } else if ("V1GroupMessageNotification" in notificationVariant) {
            let notification = notificationVariant.V1GroupMessageNotification;
            let content = extractContent(notification.message.content);
            title += notification.group_name;
            body = `${notification.sender_name}: ${content.text}`;
            icon = content.image;
        } else {
            console.log("Unexpected notification type");
            console.log(notifications);
            return;
        }

        await self.registration.showNotification(title, {body, icon});
    }
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
