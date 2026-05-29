import {
    deserializeFromMsgPack,
    Notification as TNotification,
    notification as toNotification,
    typeboxValidate,
} from "openchat-agent";
import type {
    AddedToChannelNotification,
    ChannelIdentifier,
    ChannelMessageTipped,
    ChannelNotification,
    ChannelReaction,
    CryptoTransferDetails,
    DirectMessageTipped,
    DirectNotification,
    DirectReaction,
    GroupMessageTipped,
    GroupNotification,
    GroupReaction,
    Notification,
} from "openchat-shared";
import {
    isMessageNotification,
    routeForChatIdentifier,
    routeForMessage,
    routeForMessageContext,
    toTitleCase,
    UnsupportedValueError,
} from "openchat-shared";
import { ExpirationPlugin } from "workbox-expiration";
import { staticResourceCache } from "workbox-recipes";
import { registerRoute } from "workbox-routing";
import { CustomCachePlugin } from "./cache_plugin";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-expect-error
self.__WB_DISABLE_DEV_LOGS = true;

declare const self: ServiceWorkerGlobalScope;

const pendingNotificationClicks = new Map<string, string[]>();

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
const DOCUMENT_CACHE_NAME = "openchat_network_first";
const DOCUMENT_CACHE_KEY = "openchat_document";
const NETWORK_TIMEOUT_MS = 8000;

// A valid document response must be a 200 with a non-empty body.
// Note: iOS occasionally returns a synthetic empty 200 for navigation requests
// (e.g. when the app is backgrounded/foregrounded or on a network blip).
async function isValidDocumentResponse(response: Response | undefined): Promise<boolean> {
    if (!response || response.status !== 200) return false;

    // Read only the first chunk rather than buffering the entire document.
    // content-length cannot be trusted – iOS synthetic empty 200 responses
    // can carry a non-zero header with a zero-byte body.
    const body = response.clone().body;
    if (!body) return false;
    const reader = body.getReader();
    try {
        const { value } = await reader.read();
        return value !== undefined && value.byteLength > 0;
    } catch {
        return false;
    } finally {
        await reader.cancel();
    }
}

async function logInvalidDocumentResponse(
    label: string,
    response: Response | undefined,
): Promise<void> {
    if (!response) {
        console.warn(`SW: ${label} - response was undefined`);
        return;
    }

    let bodyLength = 0;
    try {
        const buf = await response.clone().arrayBuffer();
        bodyLength = buf.byteLength;
    } catch {
        bodyLength = -1;
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });

    console.warn(`SW: ${label}`, {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        type: response.type,
        redirected: response.redirected,
        bodyLength,
        headers,
    });
}

// Fetch the document from the network with a timeout, returning undefined on
// timeout or network error.
async function fetchWithTimeout(
    request: Request,
    timeoutMs: number,
): Promise<Response | undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(request, { signal: controller.signal });
    } catch {
        return undefined;
    } finally {
        clearTimeout(timer);
    }
}

// A self-reloading fallback page shown when neither the network nor the cache
// can provide a valid document. It immediately reloads so the user is not
// stuck on a blank white screen.
function makeReloadFallbackResponse(): Response {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>location.reload();</script>
</head>
<body></body>
</html>`;
    return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

registerRoute(matchCallback, async ({ request }) => {
    const cache = await caches.open(DOCUMENT_CACHE_NAME);

    // Returns a valid cached response, or null (and purges any corrupt entry).
    async function getCachedDocument(): Promise<Response | null> {
        const cached = await cache.match(DOCUMENT_CACHE_KEY);
        if (!cached) return null;
        if (await isValidDocumentResponse(cached)) return cached;
        await logInvalidDocumentResponse("SW: cached document is invalid/empty – deleting", cached);
        await cache.delete(DOCUMENT_CACHE_KEY);
        return null;
    }

    // Try the network. If iOS returns a synthetic empty 200, retry once.
    // If the network times out or fails outright there is no point retrying – fall through to the cache.
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (!networkResponse) {
        console.warn("SW: network fetch timed out or failed – falling back to cache");
    } else if (await isValidDocumentResponse(networkResponse)) {
        await cache.put(DOCUMENT_CACHE_KEY, networkResponse.clone());
        return networkResponse;
    } else {
        await logInvalidDocumentResponse(
            "SW: invalid/empty network response – retrying",
            networkResponse,
        );

        const retryResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

        if (!retryResponse) {
            console.warn("SW: retry timed out or failed – falling back to cache");
        } else if (await isValidDocumentResponse(retryResponse)) {
            await cache.put(DOCUMENT_CACHE_KEY, retryResponse.clone());
            return retryResponse;
        } else {
            await logInvalidDocumentResponse(
                "SW: invalid/empty network response on retry – falling back to cache",
                retryResponse,
            );
        }
    }

    // Network failed or kept returning an invalid response – serve the cached document.
    const cached = await getCachedDocument();
    if (cached) {
        console.warn("SW: serving cached document after invalid/failed network response");
        return cached;
    }

    // Nothing valid anywhere – return a self-reloading placeholder so the user
    // is not left on a blank white screen.
    console.error(
        "SW: no valid document available from network or cache – serving reload fallback",
    );
    return makeReloadFallbackResponse();
});

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

self.addEventListener("message", (ev: ExtendableMessageEvent) => {
    ev.waitUntil(handleClientMessage(ev));
});

async function handlePushNotification(event: PushEvent): Promise<void> {
    const id = Date.now().toString();
    console.debug("SW: push notification received", id);
    if (!event.data) {
        console.error("SW: notification data is empty", id);
        return;
    }

    const { t, v }: TimestampedNotification = JSON.parse(event.data.text());
    const [timestamp, value] = [t, v];

    const bytes = toUint8Array(value);

    const webPushNotification = decodeWebPushNotification(bytes, timestamp);
    if (webPushNotification === undefined) {
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

    const path = event.notification.data.path as string;

    const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
    });

    if (windowClients.length > 0) {
        const window = windowClients[0];
        queueNotificationClick(window.id, path);
        window.postMessage({
            type: "NOTIFICATION_CLICKED",
            path,
        });
        await window.focus();
    } else {
        const urlToOpen = new URL(path, self.location.origin);
        console.debug("SW: notification clicked no open clients. Opening: ", urlToOpen);
        const window = await self.clients.openWindow(urlToOpen);
        if (window) {
            queueNotificationClick(window.id, path);
            window.postMessage({
                type: "NOTIFICATION_CLICKED",
                path,
            });
        }
    }
}

async function handleClientMessage(event: ExtendableMessageEvent): Promise<void> {
    if (!(event.source instanceof Client) || !event.data || typeof event.data.type !== "string") {
        return;
    }

    switch (event.data.type) {
        case "NOTIFICATION_CLIENT_READY": {
            const source = event.source;
            const pending = pendingNotificationClicks.get(source.id);
            if (pending === undefined || pending.length === 0) {
                return;
            }

            pending.forEach((path) => {
                source.postMessage({
                    type: "NOTIFICATION_CLICKED",
                    path,
                });
            });
            return;
        }

        case "NOTIFICATION_CLICKED_ACK": {
            const path = typeof event.data.path === "string" ? event.data.path : undefined;
            dequeueNotificationClick(event.source.id, path);
            return;
        }
    }
}

function queueNotificationClick(clientId: string, path: string): void {
    const pending = pendingNotificationClicks.get(clientId) ?? [];
    pending.push(path);
    pendingNotificationClicks.set(clientId, pending);
}

function dequeueNotificationClick(clientId: string, path: string | undefined): void {
    if (path === undefined) {
        pendingNotificationClicks.delete(clientId);
        return;
    }

    const pending = pendingNotificationClicks.get(clientId);
    if (pending === undefined) {
        return;
    }

    const remaining = pending.filter((pendingPath) => pendingPath !== path);
    if (remaining.length === 0) {
        pendingNotificationClicks.delete(clientId);
    } else {
        pendingNotificationClicks.set(clientId, remaining);
    }
}

function decodeWebPushNotification(bytes: Uint8Array, timestamp: bigint): Notification | undefined {
    try {
        const deserialized = deserializeFromMsgPack(bytes);
        const validated = typeboxValidate(deserialized, TNotification);
        return toNotification(validated, timestamp);
    } catch (e) {
        // Failed to decode using MsgPack
        console.error("SW: unable to decode notification", e);
    }
}

function toUint8Array(base64String: string): Uint8Array {
    try {
        return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
    } catch (e) {
        console.error("SW: unable to decode base64 string", base64String, e);
        throw e;
    }
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
        return messageText.replace(/@(?:CustomEmoji|CE)\(([^)]+)\)/g, (_, p1) => {
            return `:${p1}:`;
        });
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
            return routeForChatIdentifier("chats", n.chatId);

        case "direct_reaction":
        case "direct_message_tipped":
            return routeForMessage("chats", { chatId: n.chatId }, n.messageIndex);

        case "group_notification":
            return routeForMessageContext("chats", {
                chatId: n.chatId,
                threadRootMessageIndex: n.threadRootMessageIndex,
            });

        case "group_reaction":
        case "group_message_tipped":
            return routeForMessage(
                "chats",
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
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type TimestampedNotification = {
    t: bigint; // timestamp
    v: string; // value
};
