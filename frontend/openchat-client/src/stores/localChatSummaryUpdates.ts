import { writable } from "svelte/store";
import type { ChatSummary, LocalChatSummaryUpdates } from "openchat-shared";

const PRUNE_LOCAL_UPDATES_INTERVAL: number = 30 * 1000;
const store = writable<Record<string, LocalChatSummaryUpdates>>({});

export const localChatSummaryUpdates = {
    subscribe: store.subscribe,
    markAdded: (summary: ChatSummary): void => {
        applyUpdate(summary.chatId, (_) => ({ added: summary }));
    },
    markUpdated: (chatId: string, summaryUpdates: LocalChatSummaryUpdates["updated"]) => {
        applyUpdate(chatId, (_) => ({ updated: summaryUpdates }));
    },
    markRemoved: (chatId: string) => {
        applyUpdate(chatId, (_) => ({ removedAtTimestamp: BigInt(Date.now()) }));
    }
};

function applyUpdate(
    chatId: string,
    updateFn: (current: LocalChatSummaryUpdates) => Partial<LocalChatSummaryUpdates>
): void {
    store.update((state) => {
        const updates = state[chatId];
        state[chatId] = {
            ...updates,
            ...updateFn(updates),
            lastUpdated: Date.now(),
        };
        return state;
    });
}

function pruneLocalUpdates(): void {
    const now = Date.now();
    store.update((state) =>
        Object.entries(state).reduce((result, [chatId, updates]) => {
            // Only keep updates which are < 30 seconds old
            if (now - updates.lastUpdated < 30 * 1000) {
                result[chatId] = updates;
            }
            return result;
        }, {} as Record<string, LocalChatSummaryUpdates>)
    );
}

export function startPruningLocalChatSummaryUpdates(): void {
    window.setInterval(() => pruneLocalUpdates(), PRUNE_LOCAL_UPDATES_INTERVAL);
}
