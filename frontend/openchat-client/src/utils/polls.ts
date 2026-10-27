import type { PollContent } from "@shared";

export function totalVotes(content: PollContent): number {
    if (content.votes.total.kind === "anonymous_poll_votes") {
        return Object.values(content.votes.total.votes).reduce((total, n) => total + n, 0);
    }
    if (content.votes.total.kind === "hidden_poll_votes") {
        return content.votes.total.votes;
    }
    if (content.votes.total.kind === "visible_poll_votes") {
        return Object.values(content.votes.total.votes).reduce((total, n) => total + n.length, 0);
    }
    return 0;
}

export function votesForAnswer(content: PollContent, idx: number): number {
    if (content.votes.total.kind === "anonymous_poll_votes") {
        return content.votes.total.votes[idx] ?? 0;
    }
    if (content.votes.total.kind === "hidden_poll_votes") {
        return 0;
    }
    if (content.votes.total.kind === "visible_poll_votes") {
        return content.votes.total.votes[idx]?.length ?? 0;
    }
    return 0;
}

export function percentageOfVote(content: PollContent, idx: number) {
    const answerVotes = votesForAnswer(content, idx);
    const numberOfVotes = totalVotes(content);
    return answerVotes > 0 ? (answerVotes / numberOfVotes) * 100 : 0;
}

export function votedFor(content: PollContent, idx: number): boolean {
    return content.votes.user.includes(idx);
}

export function voteCount(content: PollContent, idx: number): number {
    const total = content.votes.total;
    switch (total.kind) {
        case "anonymous_poll_votes":
            return total.votes[idx] ?? 0;
        case "hidden_poll_votes":
            return total.votes;
        case "visible_poll_votes":
            return total.votes[idx]?.length ?? 0;
    }
}

export function getVotersForAnswer(content: PollContent, idx: number): string[] | undefined {
    if (content.votes.total.kind !== "visible_poll_votes") {
        return undefined;
    }

    return content.votes.total.votes[idx];
}

/** What the reader may do with a poll and see of it. */
export type PollView = {
    cannotVote: boolean;
    showVotes: boolean;
};

/**
 * A poll can't be voted on in a DM, when the chat is read-only, once it has ended, or again after
 * voting unless it allows changing the vote. Its votes show once it has ended, or to a voter or its
 * sender if it shows them before the end (or has no end).
 */
export function pollView(content: PollContent, reader: PollReader): PollView {
    const voted = content.votes.user.length > 0;
    return {
        cannotVote:
            reader.direct ||
            reader.readonly ||
            content.ended ||
            (voted && !content.config.allowUserToChangeVote),
        showVotes:
            content.ended ||
            ((voted || reader.sender === reader.me) &&
                (content.config.showVotesBeforeEndDate || content.config.endDate === undefined)),
    };
}

export type PollReader = { me: string; sender: string; direct: boolean; readonly: boolean };

/**
 * The vote to register when the reader's choices go from their current ones to `next`: a new
 * answer is registered (a single-choice poll swaps to it), else a dropped one is deleted. None when
 * the poll can't be voted on (`pollView`).
 */
export function pollVoteChange(
    content: PollContent,
    reader: PollReader,
    next: number[],
): { type: "register" | "delete"; answerIndex: number } | undefined {
    if (pollView(content, reader).cannotVote) return undefined;
    const current = content.votes.user;
    const added = next.find((i) => !current.includes(i));
    if (added !== undefined) return { type: "register", answerIndex: added };
    const removed = current.find((i) => !next.includes(i));
    if (removed !== undefined) return { type: "delete", answerIndex: removed };
    return undefined;
}
