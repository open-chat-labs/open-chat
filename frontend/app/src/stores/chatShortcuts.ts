import { getProxyAdjustedBlobUrl } from "@utils/media";
import { chatIdToShortcutId } from "@utils/native/share_target";
import {
    allChatsStore,
    allUsersStore,
    type ChatSummary,
    communitiesStore,
    compareChats,
    OpenChat,
} from "openchat-client";
import { derived } from "svelte/store";
import { updateChatShortcuts, type ChatShortcut } from "tauri-plugin-oc-api";

// Cap matches the typical Android Direct Share row (4 tiles). Pushing more
// doesn't necessarily display more — Android caps per-activity dynamic
// shortcuts to roughly this number anyway.
const SHORTCUT_COUNT = 4;

/**
 * Subscribe to the chats / users / communities stores and push the top-N
 * sendable chats to the Android Sharing Shortcuts API. Re-fires on any chat
 * activity but dedupes by stringified payload, so the native side (which
 * downloads avatars via Coil on each push) only churns when something
 * meaningfully changes.
 *
 * Returns an unsubscribe function. Currently never called — App.svelte fires
 * this once for the app's lifetime — but exposing it costs nothing and keeps
 * the contract symmetric with the other listener helpers.
 */
export function startChatShortcutPusher(client: OpenChat): () => void {
    const topShortcutsStore = derived(
        [allChatsStore, allUsersStore, communitiesStore],
        ([chats, users, communities]) => {
            // allChatsStore is global across scopes (direct chats, groups,
            // channels in any community). compareChats matches the comparator
            // the in-app chat list uses internally.
            //
            // Filter out non-sendable chats (OpenChatBot, proposal bot,
            // read-only groups) BEFORE slicing — otherwise one would consume
            // a tile slot.
            const sorted: ChatSummary[] = [...chats.values()].sort(compareChats);
            return sorted
                .filter((chat) => client.canSendMessage(chat.id, "message"))
                .slice(0, SHORTCUT_COUNT)
                .map<ChatShortcut>((chat) => {
                    if (chat.kind === "direct_chat") {
                        const them = users.get(chat.them.userId);
                        return {
                            id: chatIdToShortcutId(chat.id),
                            name: client.displayName(them),
                            // Adjust dev-mode localhost canister URLs so the
                            // native side can fetch the avatar bytes via Coil.
                            avatarUrl: getProxyAdjustedBlobUrl(client.userAvatarUrl(them)),
                        };
                    }
                    if (chat.kind === "channel") {
                        // Lead with the channel name so it's visible even when
                        // the community name is long enough to truncate.
                        const community = communities.get({
                            kind: "community",
                            communityId: chat.id.communityId,
                        });
                        return {
                            id: chatIdToShortcutId(chat.id),
                            name: community
                                ? `${chat.name} (${community.name})`
                                : chat.name,
                            avatarUrl: getProxyAdjustedBlobUrl(client.groupAvatarUrl(chat)),
                        };
                    }
                    return {
                        id: chatIdToShortcutId(chat.id),
                        name: chat.name,
                        avatarUrl: getProxyAdjustedBlobUrl(client.groupAvatarUrl(chat)),
                    };
                });
        },
    );

    let lastPushedKey = "";
    return topShortcutsStore.subscribe((chats) => {
        // Skip the transient empty emit during chat-list hydration — pushing
        // an empty list prunes existing shortcuts, leaving a window where the
        // system share sheet has none.
        if (chats.length === 0) return;
        const key = JSON.stringify(chats);
        if (key === lastPushedKey) return;
        lastPushedKey = key;
        updateChatShortcuts({ chats }).catch((err) =>
            console.error("Failed to update chat shortcuts", err),
        );
    });
}

/**
 * Clear all Direct Share chat shortcuts. Used on logout so the previous
 * user's chats don't sit on the system share sheet until the next user's
 * chat list hydrates. Fire-and-forget: the JS context typically dies right
 * after this (logout reloads the page), but the native Kotlin side keeps
 * running and will process the IPC regardless.
 */
export function clearChatShortcuts(): void {
    updateChatShortcuts({ chats: [] }).catch((err) =>
        console.error("Failed to clear chat shortcuts", err),
    );
}
