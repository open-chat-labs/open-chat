import type { ChatIdentifier, ChatSummary, LocalChatSummaryUpdates } from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";
import { ChatMap } from "src/utils/map";

class LocalChatSummaryUpdatesStore extends LocalUpdatesStore<
    ChatIdentifier,
    LocalChatSummaryUpdates
> {
    constructor() {
        super(new ChatMap<LocalChatSummaryUpdates>());
    }

    markAdded(summary: ChatSummary): void {
        this.applyUpdate(summary.id, (_) => ({
            added: summary,
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
