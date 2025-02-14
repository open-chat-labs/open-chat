import {
    ChatMap,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
    type ExternalBotPermissions,
    type LocalChatSummaryUpdates,
} from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalChatSummaryUpdatesStore extends LocalUpdatesStore<
    ChatIdentifier,
    LocalChatSummaryUpdates
> {
    constructor() {
        super(new ChatMap<LocalChatSummaryUpdates>());
    }

    installBot(id: ChatIdentifier, botId: string, perm: ExternalBotPermissions) {
        this.applyUpdate(id, (current) => {
            const result = { ...current };
            if (result.installedBots === undefined) {
                result.installedBots = new Map();
            }
            result.removedBots?.delete(botId);
            result.installedBots.set(botId, perm);
            return result;
        });
    }

    removeBot(id: ChatIdentifier, botId: string) {
        this.applyUpdate(id, (current) => {
            const result = { ...current };
            if (result.removedBots === undefined) {
                result.removedBots = new Set();
            }
            result.removedBots.add(botId);
            result.installedBots?.delete?.(botId);
            return result;
        });
    }

    favourite(id: ChatIdentifier): void {
        this.applyUpdate(id, (_) => ({
            favourited: true,
            unfavourited: undefined,
        }));
    }

    unfavourite(id: ChatIdentifier): void {
        this.applyUpdate(id, (_) => ({
            favourited: undefined,
            unfavourited: true,
        }));
    }

    pin(id: ChatIdentifier, scope: ChatListScope["kind"]): void {
        this.applyUpdate(id, (updates) => {
            const pinned = updates.pinned ?? new Set<ChatListScope["kind"]>();
            const unpinned = updates.unpinned ?? new Set<ChatListScope["kind"]>();
            pinned.add(scope);
            unpinned.delete(scope);
            return {
                pinned,
                unpinned: unpinned.size > 0 ? unpinned : undefined,
            };
        });
    }

    unpin(id: ChatIdentifier, scope: ChatListScope["kind"]): void {
        this.applyUpdate(id, (updates) => {
            const pinned = updates.pinned ?? new Set<ChatListScope["kind"]>();
            const unpinned = updates.unpinned ?? new Set<ChatListScope["kind"]>();
            pinned.delete(scope);
            unpinned.add(scope);
            return {
                unpinned,
                pinned: pinned.size > 0 ? pinned : undefined,
            };
        });
    }

    markAdded(summary: ChatSummary): void {
        this.applyUpdate(summary.id, (_) => ({
            added: { ...summary, membership: { ...summary.membership, lapsed: false } },
            removedAtTimestamp: undefined,
        }));
    }

    markUpdated(chatId: ChatIdentifier, summaryUpdates: LocalChatSummaryUpdates["updated"]): void {
        this.applyUpdate(chatId, (_) => ({ updated: summaryUpdates }));
    }

    markRemoved(chatId: ChatIdentifier): void {
        this.applyUpdate(chatId, (_) => ({
            added: undefined,
            removedAtTimestamp: BigInt(Date.now()),
        }));
    }

    delete(chatId: ChatIdentifier): void {
        this.deleteKey(chatId);
    }
}

export const localChatSummaryUpdates = new LocalChatSummaryUpdatesStore();
