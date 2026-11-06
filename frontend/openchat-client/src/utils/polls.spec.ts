import type { PollContent } from "@shared";
import {
    MAX_POLL_ANSWER_LENGTH,
    newPollContent,
    percentageOfVote,
    pollAnswers,
    pollVoteChange,
    type NewPoll,
    type PollReader,
} from "./polls";

function poll(
    fields: { user?: number[]; ended?: boolean; canChange?: boolean; multiple?: boolean } = {},
): PollContent {
    return {
        kind: "poll_content",
        votes: {
            total: { kind: "anonymous_poll_votes", votes: {} },
            user: fields.user ?? [],
        },
        config: {
            allowMultipleVotesPerUser: fields.multiple ?? false,
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

    // the backend ignores "change vote" on a multiple-choice poll
    test("a multiple-choice poll takes more votes whatever its change vote flag", () => {
        expect(
            pollVoteChange(poll({ user: [0], canChange: false, multiple: true }), reader, [0, 1]),
        ).toEqual({ type: "register", answerIndex: 1 });
    });

    test("a poll with no votes shows 0%, not NaN", () => {
        expect(percentageOfVote(poll(), 0)).toBe(0);
    });
});

describe("a new poll", () => {
    const built: NewPoll = {
        question: "  Lunch?  ",
        answers: [" Pizza ", "", "Tacos", " "],
        anonymous: true,
        showVotesBeforeEndDate: true,
        allowMultipleVotesPerUser: false,
        allowUserToChangeVote: true,
        durationMs: 3_600_000,
    };

    test("its answers are trimmed and the empty ones dropped", () => {
        expect(newPollContent(built, 0).config.options).toEqual(["Pizza", "Tacos"]);
        expect(newPollContent(built, 0).config.text).toBe("Lunch?");
    });

    test("it takes 2 to 10 answers, each unique ignoring case and at most 75 characters", () => {
        expect(pollAnswers(["a"]).valid).toBe(false);
        expect(pollAnswers(["a", "b"]).valid).toBe(true);
        expect(pollAnswers(["a", " A "]).valid).toBe(false);
        expect(pollAnswers(Array.from({ length: 10 }, (_, i) => `${i}`)).valid).toBe(true);
        expect(pollAnswers(Array.from({ length: 11 }, (_, i) => `${i}`)).valid).toBe(false);
        expect(pollAnswers(["a", "b".repeat(MAX_POLL_ANSWER_LENGTH)]).valid).toBe(true);
        expect(pollAnswers(["a", "b".repeat(MAX_POLL_ANSWER_LENGTH + 1)]).valid).toBe(false);
    });

    test("its end is stamped from when it's sent; one with no duration never ends", () => {
        expect(newPollContent(built, 1000).config.endDate).toBe(3_601_000n);
        expect(newPollContent({ ...built, durationMs: undefined }, 1000).config.endDate).toBe(
            undefined,
        );
    });

    test("a blank question is no question", () => {
        expect(newPollContent({ ...built, question: "  " }, 0).config.text).toBeUndefined();
    });

    // 5d invariant 6
    test("a poll's vote kind follows its settings: anonymous, visible, or hidden until it ends", () => {
        expect(newPollContent(built, 0).votes.total.kind).toBe("anonymous_poll_votes");
        // anonymous whether or not it shows its results before the end
        expect(
            newPollContent({ ...built, showVotesBeforeEndDate: false }, 0).votes.total.kind,
        ).toBe("anonymous_poll_votes");
        expect(newPollContent({ ...built, anonymous: false }, 0).votes.total).toEqual({
            kind: "visible_poll_votes",
            votes: {},
        });
        expect(
            newPollContent({ ...built, anonymous: false, showVotesBeforeEndDate: false }, 0).votes
                .total,
        ).toEqual({ kind: "hidden_poll_votes", votes: 0 });
    });

    test("a multiple-choice poll always lets its voters change their votes", () => {
        const multiple = {
            ...built,
            allowMultipleVotesPerUser: true,
            allowUserToChangeVote: false,
        };
        expect(newPollContent(multiple, 0).config.allowUserToChangeVote).toBe(true);
        expect(
            newPollContent({ ...built, allowUserToChangeVote: false }, 0).config
                .allowUserToChangeVote,
        ).toBe(false);
    });
});
