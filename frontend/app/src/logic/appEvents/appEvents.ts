import {
    chatListScopeStore,
    chatSummariesListStore,
    routeForChatIdentifier,
    routeForScope,
    subscribe,
    type ChatListScope,
    type ChatSummary,
    type DirectChatIdentifier,
    type OpenChat,
} from "@client";
import { ringForRemoteCall, stopRingingForRemoteCall } from "@src/stores/video";
import { invoke } from "@tauri-apps/api/core";

// The client's app-wide bus events, handled once for every tree. What needs a view (a dialog, a
// navigation) comes back as an outcome the tree renders; the rest is done here.

/** A dialog an event asks the app to show. */
export type AppEventDialog =
    | { kind: "not_found" }
    | { kind: "no_access" }
    | { kind: "restricted_content" }
    | { kind: "suspending"; userId: string };

export type AppEventOutcome =
    // closeDialogs: close whatever is open first (publish "closeModalStack"), as for a DM opened
    // from a profile
    | { kind: "navigate"; path: string; closeDialogs: boolean }
    | { kind: "show"; dialog: AppEventDialog };

/** Where a DM opens: in the current scope if it's already in the list there, else under chats. */
export function chatWithRoute(
    chatId: DirectChatIdentifier,
    chats: ChatSummary[],
    scope: ChatListScope,
): string {
    const known = chats.some((c) => c.kind === "direct_chat" && c.them.userId === chatId.userId);
    return routeForChatIdentifier(known ? scope.kind : "chats", chatId);
}

/** Where closing the not-found, no-access or restricted dialog goes: away from what can't be shown. */
export function dismissedRoute(client: Pick<OpenChat, "getDefaultScope">): string {
    return routeForScope(client.getDefaultScope());
}

/** Subscribes to the events; returns the unsubscribe. */
export function subscribeAppEvents(
    client: Pick<OpenChat, "getDefaultScope" | "isNativeApp" | "notificationReceived">,
    onOutcome: (outcome: AppEventOutcome) => void,
): () => void {
    const show = (dialog: AppEventDialog) => () => onOutcome({ kind: "show", dialog });
    const unsubscribes = [
        subscribe("notFound", show({ kind: "not_found" })),
        subscribe("noAccess", show({ kind: "no_access" })),
        subscribe("restrictedContent", show({ kind: "restricted_content" })),
        subscribe("suspendUser", (userId) =>
            onOutcome({ kind: "show", dialog: { kind: "suspending", userId } }),
        ),
        subscribe("selectedChatInvalid", () =>
            onOutcome({ kind: "navigate", path: dismissedRoute(client), closeDialogs: false }),
        ),
        subscribe("chatWith", (chatId) =>
            onOutcome({
                kind: "navigate",
                path: chatWithRoute(chatId, chatSummariesListStore.value, chatListScopeStore.value),
                closeDialogs: true,
            }),
        ),
        // the user's own suspension changed: start again, so everything is loaded under the new state
        subscribe("userSuspensionChanged", () => {
            if (client.isNativeApp()) {
                invoke("plugin:oc|restart_app");
            } else {
                window.location.reload();
            }
        }),
        subscribe("notification", (n) => client.notificationReceived(n)),
        subscribe("remoteVideoCallStarted", (ev) => ringForRemoteCall(ev)),
        subscribe("remoteVideoCallEnded", stopRingingForRemoteCall),
    ];
    return () => unsubscribes.forEach((u) => u());
}
