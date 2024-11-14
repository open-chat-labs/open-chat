import {
    ChatMap,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
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
        this.applyUpdate(id, (_) => ({
            pinned: scope,
            unpinned: undefined,
        }));
    }

    unpin(id: ChatIdentifier, scope: ChatListScope["kind"]): void {
        this.applyUpdate(id, (_) => ({
            pinned: undefined,
            unpinned: scope,
        }));
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
