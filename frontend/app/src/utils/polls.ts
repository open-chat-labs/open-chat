import { type PollContent } from "openchat-client";

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
    let total = content.votes.total;
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
