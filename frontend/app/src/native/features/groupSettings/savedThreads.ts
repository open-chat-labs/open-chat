import {
    chatIdentifierToString,
    type ChatIdentifier,
    type ChatPermissions,
    type MessagePermissions,
} from "@client";

// The client's local update for a saved permissions change merges it into the chat
// (mergePermissions), and that gives threads which follow the messages' permissions a set of
// their own, so a page opened again would show Separate thread permissions on. That merge is
// every tree's, and the old trees' behaviour is left as it is. So until the local update gives
// way to the server's summary (the client's local updates are undone after a minute), the
// settings pages read the threads' permissions as they were saved here.

/** How long a save's threads are read back: the client's local updates' lifetime. */
export const SAVED_THREADS_MS = 60_000;

type Saved = { threads: MessagePermissions | undefined; at: number };

export class SavedThreadPermissions {
    #saved = new Map<string, Saved>();

    /** A save of `id`'s permissions has gone through, with these threads' permissions. */
    remember(id: ChatIdentifier, threads: MessagePermissions | undefined, now = Date.now()) {
        this.#saved.set(chatIdentifierToString(id), { threads, at: now });
    }

    /** `id`'s permissions as the pages show them: the threads as saved here, within the minute. */
    apply(id: ChatIdentifier, permissions: ChatPermissions, now = Date.now()): ChatPermissions {
        const key = chatIdentifierToString(id);
        const saved = this.#saved.get(key);
        if (saved === undefined) return permissions;
        if (now - saved.at >= SAVED_THREADS_MS) {
            this.#saved.delete(key);
            return permissions;
        }
        return { ...permissions, threadPermissions: saved.threads };
    }
}

export const savedThreadPermissions = new SavedThreadPermissions();
