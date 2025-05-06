import {
    type LocalPollVote,
    type LocalReaction,
    type Message,
    type MessageContent,
    type MessageReminderCreatedContent,
    type P2PSwapStatus,
    type ThreadSummary,
} from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { ReactiveMessageMap } from "../map";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

type MessageDeleted = {
    deletedBy: string;
    timestamp: bigint;
};

export type LocalTipsReceived = SvelteMap<string, SvelteMap<string, bigint>>;

export class MessageLocalState {
    #deleted = $state<MessageDeleted | undefined>();
    #editedContent = $state<MessageContent | undefined>();
    #linkRemoved = $state<boolean>(false);
    #cancelledReminder = $state<MessageReminderCreatedContent | undefined>();
    #undeletedContent = $state<MessageContent | undefined>();
    #revealedContent = $state<MessageContent | undefined>();
    #prizeClaimed = $state<string | undefined>();
    #p2pSwapStatus = $state<P2PSwapStatus | undefined>();
    #reactions = $state<LocalReaction[]>([]);
    #pollVotes = $state<LocalPollVote[]>([]);
    #threadSummary = $state<Partial<ThreadSummary> | undefined>();
    #tips = $state(new SvelteMap<string, SvelteMap<string, bigint>>());
    #hiddenMessageRevealed = $state<boolean | undefined>();
    #blockLevelMarkdown = $state<boolean | undefined>();
    #lastUpdated = $state<number>(0);

    get deleted() {
        return this.#deleted;
    }
    set deleted(val: MessageDeleted | undefined) {
        this.#deleted = val;
    }

    get editedContent() {
        return this.#editedContent;
    }
    set editedContent(val: MessageContent | undefined) {
        this.#editedContent = val;
    }

    get linkRemoved() {
        return this.#linkRemoved;
    }
    set linkRemoved(val: boolean) {
        this.#linkRemoved = val;
    }

    get cancelledReminder() {
        return this.#cancelledReminder;
    }
    set cancelledReminder(val: MessageReminderCreatedContent | undefined) {
        this.#cancelledReminder = val;
    }

    get undeletedContent() {
        return this.#undeletedContent;
    }
    set undeletedContent(val: MessageContent | undefined) {
        this.#undeletedContent = val;
    }

    get revealedContent() {
        return this.#revealedContent;
    }
    set revealedContent(val: MessageContent | undefined) {
        this.#revealedContent = val;
    }

    get prizeClaimed() {
        return this.#prizeClaimed;
    }
    set prizeClaimed(val: string | undefined) {
        this.#prizeClaimed = val;
    }

    get p2pSwapStatus() {
        return this.#p2pSwapStatus;
    }
    set p2pSwapStatus(val: P2PSwapStatus | undefined) {
        this.#p2pSwapStatus = val;
    }

    get reactions() {
        return this.#reactions;
    }
    set reactions(val: LocalReaction[]) {
        this.#reactions = val;
    }

    get pollVotes() {
        return this.#pollVotes;
    }
    set pollVotes(val: LocalPollVote[]) {
        this.#pollVotes = val;
    }

    get threadSummary() {
        return this.#threadSummary;
    }
    set threadSummary(val: Partial<ThreadSummary> | undefined) {
        this.#threadSummary = val;
    }

    get tips() {
        return this.#tips;
    }
    set tips(val: LocalTipsReceived) {
        this.#tips = val;
    }

    get hiddenMessageRevealed() {
        return this.#hiddenMessageRevealed;
    }
    set hiddenMessageRevealed(val: boolean | undefined) {
        this.#hiddenMessageRevealed = val;
    }

    get blockLevelMarkdown() {
        return this.#blockLevelMarkdown;
    }
    set blockLevelMarkdown(val: boolean | undefined) {
        this.#blockLevelMarkdown = val;
    }

    get lastUpdated() {
        return this.#lastUpdated;
    }
    set lastUpdated(val: number) {
        this.#lastUpdated = val;
    }
}

export class MessageLocalStateManager {
    #data = new ReactiveMessageMap<MessageLocalState>();

    get(messageId: bigint): MessageLocalState | undefined {
        return this.#data.get(messageId);
    }

    #getOrCreate(messageId: bigint): MessageLocalState {
        let state = this.#data.get(messageId);
        if (state === undefined) {
            state = new MessageLocalState();
            this.#data.set(messageId, state);
        }
        return state;
    }

    get data() {
        return this.#data;
    }

    entries(): IterableIterator<[bigint, MessageLocalState]> {
        return this.#data.entries();
    }

    markLinkRemoved(messageId: bigint, content: MessageContent) {
        const state = this.#getOrCreate(messageId);
        const previous = {
            editedContent: state.editedContent,
            linkRemoved: state.linkRemoved,
        };
        state.editedContent = content;
        state.linkRemoved = true;
        return scheduleUndo(() => {
            state.editedContent = previous.editedContent;
            state.linkRemoved = previous.linkRemoved;
        });
    }

    markBlockedMessageRevealed(messageId: bigint) {
        const state = this.#getOrCreate(messageId);
        const previous = state.hiddenMessageRevealed;
        state.hiddenMessageRevealed = true;
        return scheduleUndo(() => {
            state.hiddenMessageRevealed = previous;
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
        return scheduleUndo(() => {
            state.deleted = previous.deleted;
            state.revealedContent = previous.revealedContent;
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
        return scheduleUndo(() => {
            state.deleted = previous.deleted;
            state.undeletedContent = previous.undeletedContent;
            state.revealedContent = previous.revealedContent;
        });
    }

    markDeleted(messageId: bigint, userId: string) {
        const state = this.#getOrCreate(messageId);
        const previous = state.deleted;
        state.deleted = { deletedBy: userId, timestamp: BigInt(Date.now()) };
        return scheduleUndo(() => {
            state.deleted = previous;
        });
    }

    markCancelledReminder(messageId: bigint, content: MessageReminderCreatedContent) {
        const state = this.#getOrCreate(messageId);
        const previous = state.cancelledReminder;
        state.cancelledReminder = content;
        return scheduleUndo(() => {
            state.cancelledReminder = previous;
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
        return scheduleUndo(() => {
            state.editedContent = previous.editedContent;
            state.blockLevelMarkdown = previous.blockLevelMarkdown;
            state.linkRemoved = previous.linkRemoved;
        });
    }

    markReaction(messageId: bigint, reaction: LocalReaction) {
        const state = this.#getOrCreate(messageId);
        state.reactions.push(reaction);
        return scheduleUndo(() => {
            state.reactions = state.reactions.filter((r) => r !== reaction);
        });
    }

    markTip(messageId: bigint, ledger: string, userId: string, amount: bigint) {
        const state = this.#getOrCreate(messageId);
        const previous = state.tips;

        let map = state.tips.get(ledger);
        if (map === undefined) {
            map = new SvelteMap();
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

        return scheduleUndo(() => {
            state.tips = previous;
        });
    }

    markPrizeClaimed(messageId: bigint, userId: string) {
        const state = this.#getOrCreate(messageId);
        const previous = state.prizeClaimed;
        state.prizeClaimed = userId;
        return scheduleUndo(() => {
            state.prizeClaimed = previous;
        });
    }

    setP2PSwapStatus(messageId: bigint, status: P2PSwapStatus) {
        const state = this.#getOrCreate(messageId);
        const previous = state.p2pSwapStatus;
        state.p2pSwapStatus = status;
        return scheduleUndo(() => {
            state.p2pSwapStatus = previous;
        });
    }

    markPollVote(messageId: bigint, vote: LocalPollVote) {
        const state = this.#getOrCreate(messageId);
        state.pollVotes.push(vote);
        return scheduleUndo(() => {
            state.pollVotes = state.pollVotes.filter((v) => v !== vote);
        });
    }

    markThreadSummaryUpdated(messageId: bigint, summaryUpdates: Partial<ThreadSummary>) {
        const state = this.#getOrCreate(messageId);
        const previous = state.threadSummary;
        state.threadSummary = { ...state.threadSummary, ...summaryUpdates };
        return scheduleUndo(() => {
            state.threadSummary = previous;
        });
    }

    // Only used for testing
    clearAll() {
        this.#data = new ReactiveMessageMap<MessageLocalState>();
    }
}

export const messageLocalUpdates = new MessageLocalStateManager();
