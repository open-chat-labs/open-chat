import { writable } from "svelte/store";
import type { LocalMessageUpdates, LocalPollVote, LocalReaction, MessageContent } from "../domain/chat/chat";

const PRUNE_LOCAL_REACTIONS_INTERVAL: number = 30 * 1000;
const store = writable<Record<string, LocalMessageUpdates>>({});

export const localMessageUpdates = {
    subscribe: store.subscribe,
    markDeleted: (messageId: string, deletedBy: string): void => {
        applyUpdate(messageId, (_) => ({ deleted: { deletedBy, timestamp: BigInt(Date.now()) } }));
    },
    markUndeleted: (messageId: string): void => {
        applyUpdate(messageId, (_) => ({ deleted: undefined }));
    },
    markContentEdited: (messageId: string, content: MessageContent): void => {
        applyUpdate(messageId, (_) => ({ editedContent: content }));
    },
    revertEditedContent: (messageId: string): void => {
        applyUpdate(messageId, (_) => ({ editedContent: undefined }));
    },
    markReaction: (messageId: string, reaction: LocalReaction): void => {
        applyUpdate(messageId, (updates) => ({ reactions: [...updates?.reactions ?? [], reaction] }));
    },
    markPollVote: (messageId: string, vote: LocalPollVote): void => {
        applyUpdate(messageId, (updates) => ({ pollVotes: [...updates?.pollVotes ?? [], vote] }));
    }
}

function applyUpdate(messageId: string, updateFn: (current: LocalMessageUpdates) => Partial<LocalMessageUpdates>): void {
    store.update(state => {
        const updates = state[messageId];
        state[messageId] = {
            ...updates,
            ...updateFn(updates),
            lastUpdated: Date.now()
        };
        return state;
    })
}

function pruneLocalUpdates(): void {
    const now = Date.now();
    store.update((state) => Object.entries(state).reduce((result, [messageId, updates]) => {
        // Only keep updates which are < 30 seconds old
        if (now - updates.lastUpdated < 30 * 1000) {
            result[messageId] = updates;
        }
        return result;
    }, {} as Record<string, LocalMessageUpdates>));
}

export function startPruningLocalUpdates(): void {
    window.setInterval(() => pruneLocalUpdates(), PRUNE_LOCAL_REACTIONS_INTERVAL);
}
