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
        return (
            this.deleted === undefined &&
            this.editedContent === undefined &&
            this.cancelledReminder === undefined &&
            this.undeletedContent === undefined &&
            this.revealedContent === undefined &&
            this.prizeClaimed === undefined &&
            this.p2pSwapStatus === undefined &&
            this.reactions.length === 0 &&
            this.pollVotes.length === 0 &&
            this.threadSummary === undefined &&
            this.tips.size === 0 &&
            this.hiddenMessageRevealed === undefined &&
            this.blockLevelMarkdown === undefined &&
            this.proposalTally === undefined &&
            this.ogPreviews === undefined
        );
    }
}

export const messageLocalUpdates = writable<MessageMap<MessageLocalUpdates>>(
    new MessageMap(),
    undefined,
    notEq,
);
