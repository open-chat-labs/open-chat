import {
    MessageMap,
    type LocalMessageUpdates,
    type LocalPollVote,
    type LocalReaction,
    type MessageContent,
    type P2PSwapStatus,
    type ThreadSummary,
} from "openchat-shared";
import { isEmpty } from "../utils/object";
import { LocalUpdatesStore } from "./localUpdatesStore";

export class LocalMessageUpdatesStore extends LocalUpdatesStore<
    bigint,
    LocalMessageUpdates,
    string
> {
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
            revealedContent: undefined,
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
            hiddenMessageRevealed: true,
        }));
    }
    setBlockLevelMarkdown(messageId: bigint, blockLevelMarkdown: boolean): void {
        this.applyUpdate(messageId, (_) => ({
            blockLevelMarkdown,
        }));
    }
    markContentEdited(messageId: bigint, content: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: content, linkRemoved: false }));
    }
    revertEditedContent(messageId: bigint): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: undefined, linkRemoved: false }));
    }
    markLinkRemoved(messageId: bigint, content: MessageContent): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: content, linkRemoved: true }));
    }
    revertLinkRemoved(messageId: bigint): void {
        this.applyUpdate(messageId, (_) => ({ editedContent: undefined, linkRemoved: false }));
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

                if (isEmpty(result.tips[ledger])) {
                    delete result.tips[ledger];
                }
            }

            return result;
        });
    }
    markPrizeClaimed(messageId: bigint, userId: string): void {
        this.applyUpdate(messageId, (_) => ({ prizeClaimed: userId }));
    }
    setP2PSwapStatus(messageId: bigint, status: P2PSwapStatus): void {
        this.applyUpdate(messageId, (_) => ({ p2pSwapStatus: status }));
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
