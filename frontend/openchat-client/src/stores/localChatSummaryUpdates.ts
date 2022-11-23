import type { ChatSummary, LocalChatSummaryUpdates } from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalChatSummaryUpdatesStore extends LocalUpdatesStore<LocalChatSummaryUpdates> {
    markAdded(summary: ChatSummary): void {
        this.applyUpdate(summary.chatId, (_) => ({ added: summary, removedAtTimestamp: undefined }));
    }
    markUpdated(chatId: string, summaryUpdates: LocalChatSummaryUpdates["updated"]): void {
        this.applyUpdate(chatId, (_) => ({ updated: summaryUpdates }));
    }
    markRemoved(chatId: string): void {
        this.applyUpdate(chatId, (_) => ({ added: undefined, removedAtTimestamp: BigInt(Date.now()) }));
    }
}

export const localChatSummaryUpdates = new LocalChatSummaryUpdatesStore();
