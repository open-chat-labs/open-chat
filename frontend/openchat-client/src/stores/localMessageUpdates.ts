import {
    MessageMap,
    type LocalMessageUpdates,
    type LocalPollVote,
    type LocalReaction,
    type MessageContent,
    type ThreadSummary,
} from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

export class LocalMessageUpdatesStore extends LocalUpdatesStore<bigint, LocalMessageUpdates> {
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
    markBlockedMessageRevealed(messageId: bigint): void {
        this.applyUpdate(messageId, (_) => ({
            blockedMessageRevealed: true,
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
    markTip(messageId: bigint, ledger: string, userId: string, amount: bigint) {
        this.applyUpdate(messageId, (updates) => {
            const result = { ...updates };

            if (result.tips === undefined) {
                result.tips = {};
            }

            if (result.tips[ledger] === undefined) {
                result.tips[ledger] = {};
            }

            if (result.tips[ledger][userId] === undefined) {
                result.tips[ledger][userId] = amount;
            } else {
                result.tips[ledger][userId] = result.tips[ledger][userId] + amount;
            }

            if (result.tips[ledger][userId] <= 0n) {
                delete result.tips[ledger][userId];
            }

            return result;
        });
    }
    markPrizeClaimed(messageId: bigint, userId: string): void {
        this.applyUpdate(messageId, (_) => ({ prizeClaimed: userId }));
    }
    markPollVote(messageId: bigint, vote: LocalPollVote): void {
        this.applyUpdate(messageId, (updates) => ({
            pollVotes: [...(updates?.pollVotes ?? []), vote],
        }));
    }
    markThreadSummaryUpdated(
        threadRootMessageId: bigint,
        summaryUpdates: Partial<ThreadSummary>,
    ): void {
        this.applyUpdate(threadRootMessageId, (updates) => {
            return {
                threadSummary:
                    updates?.threadSummary === undefined
                        ? summaryUpdates
                        : { ...updates.threadSummary, ...summaryUpdates },
            };
        });
    }
}

export const localMessageUpdates = new LocalMessageUpdatesStore(new MessageMap());
