import { addPluginListener, convertFileSrc, type PluginListener } from "@tauri-apps/api/core";
import { pendingShareStore } from "@stores/pendingShare";
import {
    type ChatIdentifier,
    LazyFile,
    chatListScopeStore,
    localUpdates,
    OpenChat,
    pageNavigate,
    routeForChatIdentifier,
} from "openchat-client";
import { get } from "svelte/store";
import type { Share } from "../share";

const TAURI_PLUGIN_NAME = "oc";
const SHARE_TARGET_EVENT = "share-target";

/**
 * One shared file. The native side copies content URIs into app cache before
 * raising the event, so {@link path} can be read for as long as the app lives
 * (the source app's temporary read grant would otherwise expire).
 */
export interface SharedFile {
    path: string;
    name: string;
    mimeType: string | null;
    size: number;
}

/**
 * Payload delivered when the user selects OpenChat from the system share sheet
 * or taps one of our Direct Share chat shortcuts.
 */
export interface ShareTarget {
    /** Original mime type from the source share intent. */
    mimeType: string;
    /** Plain text payload (EXTRA_TEXT). Present for text/URL shares. */
    text: string | null;
    /** Chat id this share was directed at, when launched from a Direct Share
     *  shortcut. Null when launched via "OpenChat" in the generic share sheet. */
    shortcutId: string | null;
    /** Files copied into app cache, ready to feed into the upload path. */
    files: SharedFile[];
}

/**
 * Subscribe to share intents delivered from the Android system share sheet.
 * Cold-start shares are queued by the native side and delivered once Svelte
 * signals svelteReady.
 */
export async function expectShareTarget(
    handler: (share: ShareTarget) => void,
): Promise<PluginListener> {
    return addPluginListener(TAURI_PLUGIN_NAME, SHARE_TARGET_EVENT, handler);
}

/**
 * Encode a {@link ChatIdentifier} as an opaque string suitable for Android
 * shortcut ids. The kind prefix lets us reverse the mapping unambiguously —
 * the existing chatIdentifierToString drops the kind, which makes direct vs
 * group ids indistinguishable when the shortcut launches our activity.
 */
export function chatIdToShortcutId(id: ChatIdentifier): string {
    switch (id.kind) {
        case "direct_chat":
            return `d:${id.userId}`;
        case "group_chat":
            return `g:${id.groupId}`;
        case "channel":
            return `c:${id.communityId}:${id.channelId}`;
    }
}

export function shortcutIdToChatId(s: string): ChatIdentifier | undefined {
    const colon = s.indexOf(":");
    if (colon < 0) return undefined;
    const kind = s.slice(0, colon);
    const rest = s.slice(colon + 1);
    switch (kind) {
        case "d":
            return { kind: "direct_chat", userId: rest };
        case "g":
            return { kind: "group_chat", groupId: rest };
        case "c": {
            const sep = rest.lastIndexOf(":");
            if (sep < 0) return undefined;
            const channelId = Number(rest.slice(sep + 1));
            if (!Number.isFinite(channelId)) return undefined;
            return {
                kind: "channel",
                communityId: rest.slice(0, sep),
                channelId,
            };
        }
        default:
            return undefined;
    }
}

/**
 * Drop the share content into the chat's draft and navigate to it. Used by
 * the Direct Share fast-path; the modal-picker path goes through the existing
 * "shareMessage" event in {@link handleShareTarget} instead.
 */
export function shareToChat(
    client: OpenChat,
    chatId: ChatIdentifier,
    shareTarget: ShareTarget,
): void {
    const text = shareTarget.text ?? "";
    if (text.length > 0) {
        localUpdates.draftMessages.setTextContent({ chatId }, text);
    }
    const firstFile = shareTarget.files[0];
    if (firstFile) {
        const lazy = LazyFile.fromUrl(
            convertFileSrc(firstFile.path),
            firstFile.name,
            firstFile.mimeType ?? "application/octet-stream",
            firstFile.size,
        );
        client
            .messageContentFromFile(lazy as unknown as File)
            .then((content) => localUpdates.draftMessages.setAttachment({ chatId }, content))
            .catch((err) => console.error("Failed to attach shared file", err));
    }
    // pageNavigate (rather than raw page()) polls routerReadyStore until the
    // router has finished its initial setup. Cold-start shares arrive while
    // Home.svelte is still pageReplacing the home_route to the default scope,
    // so we'd otherwise lose the race; this gates us until the route resolver
    // is settled.
    pageNavigate(routeForChatIdentifier(get(chatListScopeStore).kind, chatId));
}

/**
 * Entry point for incoming share-target events. Routes to either the Direct
 * Share fast-path (when the share carries a known shortcut id) or the generic
 * "shareMessage" picker flow (reuses the in-app share infrastructure).
 */
export function handleShareTarget(client: OpenChat, shareTarget: ShareTarget): void {
    if (shareTarget.shortcutId) {
        const chatId = shortcutIdToChatId(shareTarget.shortcutId);
        if (chatId !== undefined) {
            shareToChat(client, chatId, shareTarget);
            return;
        }
        // Unrecognised shortcut id — fall through to the picker.
    }

    const text = shareTarget.text ?? "";
    // Wrap each shared file path in a LazyFile so messageContentFromFile can
    // stream bytes through Tauri's asset protocol instead of buffering them
    // across the IPC boundary.
    const files = shareTarget.files.map((f) =>
        LazyFile.fromUrl(
            convertFileSrc(f.path),
            f.name,
            f.mimeType ?? "application/octet-stream",
            f.size,
        ),
    );
    const share: Share = {
        title: undefined,
        text: text.length > 0 ? text : undefined,
        url: undefined,
        files: files as unknown as File[],
    };
    // Use a writable store rather than publish() so cold-start shares that
    // arrive before SlidingModals has subscribed don't get dropped. The
    // store retains the value; SlidingModals reads it on mount.
    pendingShareStore.set(share);
}
