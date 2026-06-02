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

// Minimum tiles to allocate to each category before filling remaining slots
// by recency. Without these floors, a user who's recently active in just one
// community can end up with all 4 tiles pointing at the same set of channels,
// which makes the share sheet much less useful.
const MIN_DIRECT_CHATS = 2;
const MIN_GROUPS_AND_CHANNELS = 1;

// Pick the chats that should become Direct Share tiles. Reserves the
// category minimums first, then fills the remaining slots by overall recency
// across both pools. Falls back gracefully when one category is empty or
// short (e.g. a user with no DMs yet gets 4 group/channel tiles instead).
function selectShortcutChats(sortedSendable: ChatSummary[]): ChatSummary[] {
    const directs: ChatSummary[] = [];
    const groupsAndChannels: ChatSummary[] = [];
    for (const chat of sortedSendable) {
        if (chat.kind === "direct_chat") {
            directs.push(chat);
        } else {
            groupsAndChannels.push(chat);
        }
    }

    const reserved: ChatSummary[] = [
        ...directs.slice(0, Math.min(MIN_DIRECT_CHATS, directs.length)),
        ...groupsAndChannels.slice(0, Math.min(MIN_GROUPS_AND_CHANNELS, groupsAndChannels.length)),
    ];
    const reservedIds = new Set(reserved.map((c) => chatIdToShortcutId(c.id)));
    const remaining = sortedSendable.filter(
        (c) => !reservedIds.has(chatIdToShortcutId(c.id)),
    );
    const filled = reserved.concat(remaining.slice(0, SHORTCUT_COUNT - reserved.length));

    // Re-sort by recency so the most active chat lands first in the tile
    // row — the category-floor logic above scrambles that order.
    return filled.sort(compareChats);
}

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
            // read-only groups) BEFORE handing to the selector — otherwise
            // they'd consume tile slots that the floors are trying to reserve.
            const sortedSendable: ChatSummary[] = [...chats.values()]
                .sort(compareChats)
                .filter((chat) => client.canSendMessage(chat.id, "message"));
            return selectShortcutChats(sortedSendable).map<ChatShortcut>((chat) => {
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
                        name: community ? `${chat.name} (${community.name})` : chat.name,
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
        // Skip *only* the transient empty emit that fires during initial
        // chat-list hydration (before we've pushed anything). A genuine
        // transition to zero sendable chats — e.g. the user just left every
        // group / deleted every DM — needs to propagate so the native side
        // can prune the stale share-target tiles. We detect "haven't pushed
        // yet" by the sentinel empty-string initial value of lastPushedKey.
        if (chats.length === 0 && lastPushedKey === "") return;
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
