import {
    MessageMap,
    type LocalPollVote,
    type LocalReaction,
    type MessageContent,
    type MessageReminderCreatedContent,
    type P2PSwapStatus,
    type Tally,
    type ThreadSummary,
} from "openchat-shared";
import { writable } from "../../utils/stores";
import { notEq } from "../utils";

export type MessageDeleted = {
    deletedBy: string;
    timestamp: bigint;
};

export type LocalTipsReceived = Map<string, Map<string, bigint>>;

export class MessageLocalUpdates {
    deleted?: MessageDeleted;
    editedContent?: MessageContent;
    linkRemoved: boolean = false;
    cancelledReminder?: MessageReminderCreatedContent;
    undeletedContent?: MessageContent;
    revealedContent?: MessageContent;
    prizeClaimed?: boolean;
    p2pSwapStatus?: P2PSwapStatus;
    reactions: LocalReaction[] = [];
    pollVotes: LocalPollVote[] = [];
    threadSummary?: Partial<ThreadSummary>;
    tips: LocalTipsReceived = new Map<string, Map<string, bigint>>();
    hiddenMessageRevealed?: boolean;
    blockLevelMarkdown?: boolean;
    proposalTally?: Tally;
    lastUpdated: number = 0;
}

export const messageLocalUpdates = writable<MessageMap<MessageLocalUpdates>>(
    new MessageMap(),
    undefined,
    notEq,
);
