import {
    type LocalPollVote,
    type LocalReaction,
    type Message,
    type MessageContent,
    type MessageReminderCreatedContent,
    type P2PSwapStatus,
    type ThreadSummary,
} from "openchat-shared";
import { MessageMapStore } from "../map";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

type MessageDeleted = {
    deletedBy: string;
    timestamp: bigint;
};

export type LocalTipsReceived = Map<string, Map<string, bigint>>;

export class MessageLocalState {
    deleted?: MessageDeleted;
    editedContent?: MessageContent;
    linkRemoved: boolean = false;
    cancelledReminder?: MessageReminderCreatedContent;
    undeletedContent?: MessageContent;
    revealedContent?: MessageContent;
    prizeClaimed?: string;
    p2pSwapStatus?: P2PSwapStatus;
    reactions: LocalReaction[] = [];
    pollVotes: LocalPollVote[] = [];
    threadSummary?: Partial<ThreadSummary>;
    tips: LocalTipsReceived = new Map<string, Map<string, bigint>>();
    hiddenMessageRevealed?: boolean;
    blockLevelMarkdown?: boolean;
    lastUpdated: number = 0;
}

export class MessageLocalStateManager extends MessageMapStore<MessageLocalState> {
    #getOrCreate(messageId: bigint): MessageLocalState {
        return this.get(messageId) ?? new MessageLocalState();
    }

    markLinkRemoved(messageId: bigint, content: MessageContent) {
        const state = this.#getOrCreate(messageId);
        const previous = {
            editedContent: state.editedContent,
            linkRemoved: state.linkRemoved,
        };
        state.editedContent = content;
        state.linkRemoved = true;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, ...previous }));
        });
    }

    markBlockedMessageRevealed(messageId: bigint) {
        const state = this.#getOrCreate(messageId);
        const previous = state.hiddenMessageRevealed;
        state.hiddenMessageRevealed = true;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, hiddenMessageRevealed: previous }));
        });
    }

    markContentRevealed(messageId: bigint, content: MessageContent) {
        const state = this.#getOrCreate(messageId);
        const previous = {
            deleted: state.deleted,
            revealedContent: state.revealedContent,
        };
        state.deleted = undefined;
        state.revealedContent = content;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, ...previous }));
        });
    }

    markUndeleted(messageId: bigint, content?: MessageContent) {
        const state = this.#getOrCreate(messageId);
        const previous = {
            deleted: state.deleted,
            undeletedContent: state.undeletedContent,
            revealedContent: state.revealedContent,
        };
        state.deleted = undefined;
        state.undeletedContent = content;
        state.revealedContent = undefined;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, ...previous }));
        });
    }

    markDeleted(messageId: bigint, userId: string) {
        const state = this.#getOrCreate(messageId);
        const previous = state.deleted;
        state.deleted = { deletedBy: userId, timestamp: BigInt(Date.now()) };
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, deleted: previous }));
        });
    }

    markCancelledReminder(messageId: bigint, content: MessageReminderCreatedContent) {
        const state = this.#getOrCreate(messageId);
        const previous = state.cancelledReminder;
        state.cancelledReminder = content;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, cancelledReminder: previous }));
        });
    }

    markContentEdited(
        { messageId, content }: Message,
        blockLevelMarkdown?: boolean,
    ): UndoLocalUpdate {
        const state = this.#getOrCreate(messageId);
        const previous = {
            editedContent: state.editedContent,
            blockLevelMarkdown: state.blockLevelMarkdown,
            linkRemoved: state.linkRemoved,
        };
        state.editedContent = content;
        state.blockLevelMarkdown = blockLevelMarkdown;
        state.linkRemoved = false;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, ...previous }));
        });
    }

    markReaction(messageId: bigint, reaction: LocalReaction) {
        const state = this.#getOrCreate(messageId);
        state.reactions.push(reaction);
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({
                ...val,
                reactions: val.reactions.filter((r) => r !== reaction),
            }));
        });
    }

    markTip(messageId: bigint, ledger: string, userId: string, amount: bigint) {
        const state = this.#getOrCreate(messageId);
        const previous = state.tips;

        let map = state.tips.get(ledger);
        if (map === undefined) {
            map = new Map();
            state.tips.set(ledger, map);
        }

        const currentAmount = map.get(userId);
        if (currentAmount === undefined) {
            map.set(userId, amount);
        } else {
            map.set(userId, currentAmount + amount);
        }

        if ((map.get(userId) ?? 0) <= 0n) {
            map.delete(userId);
        }

        if (map.size === 0) {
            state.tips.delete(ledger);
        }

        this.set(messageId, state);

        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, tips: previous }));
        });
    }

    markPrizeClaimed(messageId: bigint, userId: string) {
        const state = this.#getOrCreate(messageId);
        const previous = state.prizeClaimed;
        state.prizeClaimed = userId;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, prizeClaimed: previous }));
        });
    }

    setP2PSwapStatus(messageId: bigint, status: P2PSwapStatus) {
        const state = this.#getOrCreate(messageId);
        const previous = state.p2pSwapStatus;
        state.p2pSwapStatus = status;
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, p2pSwapStatus: previous }));
        });
    }

    markPollVote(messageId: bigint, vote: LocalPollVote) {
        const state = this.#getOrCreate(messageId);
        state.pollVotes.push(vote);
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({
                ...val,
                pollVotes: val.pollVotes.filter((v) => v !== vote),
            }));
        });
    }

    markThreadSummaryUpdated(messageId: bigint, summaryUpdates: Partial<ThreadSummary>) {
        const state = this.#getOrCreate(messageId);
        const previous = state.threadSummary;
        state.threadSummary = { ...state.threadSummary, ...summaryUpdates };
        this.set(messageId, state);
        return scheduleUndo(() => {
            this.update(messageId, (val) => ({ ...val, threadSummary: previous }));
        });
    }

    // Only used for testing
    clearAll() {
        this.clear();
    }
}

export const messageLocalUpdates = new MessageLocalStateManager();
