import type {
    LocalMessageUpdates,
    LocalPollVote,
    LocalReaction,
    MessageContent,
    ThreadSummary,
} from "openchat-shared";
import { mergeThreadSummaries } from "../utils/chat";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalMessageUpdatesStore extends LocalUpdatesStore<LocalMessageUpdates> {
    markDeleted(messageId: string, deletedBy: string): void {
        this.applyUpdate(messageId, (_) => ({ deleted: { deletedBy, timestamp: BigInt(Date.now()) } }));
    }
    markUndeleted(messageId: string): void {
        this.applyUpdate(messageId, (_) => ({ deleted: undefined }));
    }
    markContentEdited(messageId: string, content: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: content }));
    }
    revertEditedContent(messageId: string): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: undefined }));
    }
    markReaction(messageId: string, reaction: LocalReaction): void {
        this.applyUpdate(messageId, (updates) => ({
            reactions: [...(updates?.reactions ?? []), reaction],
        }));
    }
    markPollVote(messageId: string, vote: LocalPollVote): void {
        this.applyUpdate(messageId, (updates) => ({ pollVotes: [...(updates?.pollVotes ?? []), vote] }));
    }
    markThreadSummaryUpdated(threadRootMessageId: string, summary: ThreadSummary): void {
        this.applyUpdate(threadRootMessageId, (updates) => {
            return {
                threadSummary:
                    updates?.threadSummary === undefined
                        ? summary
                        : mergeThreadSummaries(updates.threadSummary, summary),
            };
        });
    }
}

export const localMessageUpdates = new LocalMessageUpdatesStore();
