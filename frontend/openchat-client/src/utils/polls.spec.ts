import type { PollContent } from "@shared";
import { percentageOfVote, pollVoteChange, type PollReader } from "./polls";

function poll(fields: { user?: number[]; ended?: boolean; canChange?: boolean } = {}): PollContent {
    return {
        kind: "poll_content",
        votes: {
            total: { kind: "anonymous_poll_votes", votes: {} },
            user: fields.user ?? [],
        },
        config: {
            allowMultipleVotesPerUser: false,
            allowUserToChangeVote: fields.canChange ?? true,
            showVotesBeforeEndDate: true,
            anonymous: true,
            options: ["a", "b", "c"],
        },
        ended: fields.ended ?? false,
    };
}

const reader: PollReader = { me: "me", sender: "alice", direct: false, readonly: false };

describe("a poll vote", () => {
    // 5a invariant 4
    test("a poll can't be voted on in a DM, once ended, or again without change vote", () => {
        expect(pollVoteChange(poll(), { ...reader, direct: true }, [0])).toBeUndefined();
        expect(pollVoteChange(poll({ ended: true }), reader, [0])).toBeUndefined();
        expect(pollVoteChange(poll({ user: [0], canChange: false }), reader, [1])).toBeUndefined();
        expect(pollVoteChange(poll(), { ...reader, readonly: true }, [0])).toBeUndefined();
    });

    test("registers a new answer, else deletes a dropped one", () => {
        expect(pollVoteChange(poll(), reader, [1])).toEqual({ type: "register", answerIndex: 1 });
        expect(pollVoteChange(poll({ canChange: false }), reader, [0])).toEqual({
            type: "register",
            answerIndex: 0,
        });
        expect(pollVoteChange(poll({ user: [0] }), reader, [2])).toEqual({
            type: "register",
            answerIndex: 2,
        });
        expect(pollVoteChange(poll({ user: [0] }), reader, [])).toEqual({
            type: "delete",
            answerIndex: 0,
        });
    });

    test("a poll with no votes shows 0%, not NaN", () => {
        expect(percentageOfVote(poll(), 0)).toBe(0);
    });
});
