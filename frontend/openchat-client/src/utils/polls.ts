import type { PollConfig, PollContent, TotalPollVotes } from "@shared";

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

/**
 * Whether a poll's votes can change. A multiple-choice poll's always can: the backend lets a voter
 * add and remove votes whatever its "change vote" flag says, so the flag only counts for single
 * choice.
 */
export function allowsVoteChange(
    config: Pick<PollConfig, "allowMultipleVotesPerUser" | "allowUserToChangeVote">,
): boolean {
    return config.allowMultipleVotesPerUser || config.allowUserToChangeVote;
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
            (voted && !allowsVoteChange(content.config)),
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

/** The most answers a poll can have. */
export const MAX_POLL_ANSWERS = 10;
/** The longest a poll's question can be. */
export const MAX_POLL_QUESTION_LENGTH = 250;
/** The longest a poll's answer can be (the mobile app's, and the new UI's). */
export const MAX_POLL_ANSWER_LENGTH = 75;

/**
 * A poll's answers as they'll be sent: trimmed, with the empty ones dropped. They're valid when
 * there are 2 to 10 of them, none too long, and no two the same ignoring case.
 */
export function pollAnswers(answers: string[]): { answers: string[]; valid: boolean } {
    const filled = answers.map((a) => a.trim()).filter((a) => a !== "");
    const unique = new Set(filled.map((a) => a.toUpperCase()));
    return {
        answers: filled,
        valid:
            filled.length >= 2 &&
            filled.length <= MAX_POLL_ANSWERS &&
            filled.every((a) => a.length <= MAX_POLL_ANSWER_LENGTH) &&
            unique.size === filled.length,
    };
}

/**
 * The votes a new poll starts with, which follow its settings: an anonymous poll's are counted per
 * answer, a public one's name their voters, and a public one that hides its results until it ends
 * holds only a total.
 */
export function newPollVotes(settings: {
    anonymous: boolean;
    showVotesBeforeEndDate: boolean;
}): TotalPollVotes {
    if (settings.anonymous) return { kind: "anonymous_poll_votes", votes: {} };
    if (settings.showVotesBeforeEndDate) return { kind: "visible_poll_votes", votes: {} };
    return { kind: "hidden_poll_votes", votes: 0 };
}

/** A poll as a builder holds it. */
export type NewPoll = {
    /** None (or blank) for a poll with no question (the old desktop builder allows one). */
    question: string | undefined;
    /** As typed: `pollAnswers` keeps the ones sent. */
    answers: string[];
    anonymous: boolean;
    showVotesBeforeEndDate: boolean;
    allowMultipleVotesPerUser: boolean;
    allowUserToChangeVote: boolean;
    /** How long it runs once it's sent; none for a poll that never ends. */
    durationMs: number | undefined;
};

/**
 * The poll to send, its end stamped from `now` (when it's sent, not when its duration was picked)
 * and its answers as `pollAnswers` keeps them. A multiple-choice poll always lets its voters
 * change their votes (`allowsVoteChange`).
 */
export function newPollContent(poll: NewPoll, now: number): PollContent {
    const question = poll.question?.trim();
    return {
        kind: "poll_content",
        votes: { total: newPollVotes(poll), user: [] },
        config: {
            allowMultipleVotesPerUser: poll.allowMultipleVotesPerUser,
            allowUserToChangeVote: allowsVoteChange(poll),
            text: question === undefined || question === "" ? undefined : question,
            showVotesBeforeEndDate: poll.showVotesBeforeEndDate,
            endDate: poll.durationMs === undefined ? undefined : BigInt(now + poll.durationMs),
            anonymous: poll.anonymous,
            options: pollAnswers(poll.answers).answers,
        },
        ended: false,
    };
}
