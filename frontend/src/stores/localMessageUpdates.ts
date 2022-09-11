import { writable } from "svelte/store";
import type { LocalMessageUpdates, LocalPollVote, LocalReaction } from "domain/chat/chat";

const PRUNE_LOCAL_REACTIONS_INTERVAL: number = 30 * 1000;
const store = writable<Record<string, LocalMessageUpdates>>({});

export const localMessageUpdates = {
    subscribe: store.subscribe,
    markDeleted: (messageId: string, deletedBy: string) => {
        store.update(state => {
            state[messageId] = {
                ...state[messageId],
                deleted: {
                    deletedBy,
                    timestamp: BigInt(Date.now())
                },
                lastUpdated: Date.now()
            };
            return state;
        })
    },
    markUndeleted: (messageId: string) => {
        store.update(state => {
            state[messageId] = {
                ...state[messageId],
                deleted: undefined,
                lastUpdated: Date.now()
            };
            return state;
        })
    },
    markReaction: (messageId: string, reaction: LocalReaction) => {
        store.update(state => {
            state[messageId] = {
                ...state[messageId],
                reactions: [...state[messageId]?.reactions ?? [], reaction],
                lastUpdated: Date.now()
            };
            return state;
        })
    },
    markPollVote: (messageId: string, vote: LocalPollVote) => {
        store.update(state => {
            state[messageId] = {
                ...state[messageId],
                pollVotes: [...state[messageId]?.pollVotes ?? [], vote],
                lastUpdated: Date.now()
            };
            return state;
        })
    }
}

function pruneLocalUpdates() {
    const now = Date.now();
    store.update((state) => Object.entries(state).reduce((result, [messageId, updates]) => {
        // Only keep updates which are < 30 seconds old
        if (now - updates.lastUpdated < 30 * 1000) {
            result[messageId] = updates;
        }
        return result;
    }, {} as Record<string, LocalMessageUpdates>));
}

export function startPruningLocalUpdates() {
    window.setInterval(() => pruneLocalUpdates(), PRUNE_LOCAL_REACTIONS_INTERVAL);
}
