import type {
    LocalMessageUpdates,
    LocalPollVote,
    LocalReaction,
    MessageContent,
    ThreadSummary,
} from "openchat-shared";
import { mergeThreadSummaries } from "../utils/chat";
import { LocalUpdatesStore } from "./localUpdatesStore";
import { MessageMap } from "../utils/map";

class LocalMessageUpdatesStore extends LocalUpdatesStore<bigint, LocalMessageUpdates> {
    markCancelled(messageId: bigint, content: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({
            cancelledReminder: content,
        }));
    }
    revertCancelled(messageId: bigint): void {
        this.applyUpdate(messageId, (_) => ({
            cancelledReminder: undefined,
        }));
    }
    markDeleted(messageId: bigint, deletedBy: string): void {
        this.applyUpdate(messageId, (_) => ({
            deleted: { deletedBy, timestamp: BigInt(Date.now()) },
        }));
    }
    markUndeleted(messageId: bigint, content?: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({
            deleted: undefined,
            undeletedContent: content,
        }));
    }
    markContentRevealed(messageId: bigint, content: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({
            deleted: undefined,
            revealedContent: content,
        }));
    }
    markContentEdited(messageId: bigint, content: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: content }));
    }
    revertEditedContent(messageId: bigint): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: undefined }));
    }
    markReaction(messageId: bigint, reaction: LocalReaction): void {
        this.applyUpdate(messageId, (updates) => ({
            reactions: [...(updates?.reactions ?? []), reaction],
        }));
    }
    markPrizeClaimed(messageId: bigint, userId: string): void {
        this.applyUpdate(messageId, (_) => ({ prizeClaimed: userId }));
    }
    markPollVote(messageId: bigint, vote: LocalPollVote): void {
        this.applyUpdate(messageId, (updates) => ({
            pollVotes: [...(updates?.pollVotes ?? []), vote],
        }));
    }
    markThreadSummaryUpdated(threadRootMessageId: bigint, summary: ThreadSummary): void {
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

export const localMessageUpdates = new LocalMessageUpdatesStore(new MessageMap());
