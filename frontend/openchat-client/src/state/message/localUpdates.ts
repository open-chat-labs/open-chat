import {
    MessageMap,
    type LocalPollVote,
    type LocalReaction,
    type MessageContent,
    type MessageReminderCreatedContent,
    type OgPreview,
    type P2PSwapStatus,
    type Tally,
    type ThreadSummary,
} from "@shared";
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
    ogPreviews?: OgPreview[];

    isEmpty(): boolean {
        return Object.entries(this).every(
            ([key, value]) =>
                key === "lastUpdated" ||
                value === undefined ||
                (Array.isArray(value) && value.length === 0) ||
                (value instanceof Map && value.size === 0),
        );
    }
}

export const messageLocalUpdates = writable<MessageMap<MessageLocalUpdates>>(
    new MessageMap(),
    undefined,
    notEq,
);
