import { newPollContent } from "@client";
import type { PollDraft } from "@openchat/ui/src/features/components/PollBuilderDialog.svelte";
import { newPoll } from "./builders.adapter";

describe("a poll from the builder", () => {
    const draft: PollDraft = {
        question: "Lunch?",
        options: [
            { label: "Pizza", votes: 0 },
            { label: "Tacos", votes: 0 },
        ],
        multiple: false,
        publicVotes: false,
        canChange: true,
        hideResults: false,
        durationMs: 86_400_000,
        endsIn: "1 day",
        endsAt: 0,
    };

    test("keeps its question, answers and how long it runs", () => {
        expect(newPoll(draft)).toEqual({
            question: "Lunch?",
            answers: ["Pizza", "Tacos"],
            anonymous: true,
            showVotesBeforeEndDate: true,
            allowMultipleVotesPerUser: false,
            allowUserToChangeVote: true,
            durationMs: 86_400_000,
        });
    });

    // 5d invariant 6, through the builder's settings
    test("a poll's vote kind follows its settings: anonymous, visible, or hidden until it ends", () => {
        const kind = (d: Partial<PollDraft>) =>
            newPollContent(newPoll({ ...draft, ...d }), 0).votes.total.kind;
        expect(kind({})).toBe("anonymous_poll_votes");
        expect(kind({ publicVotes: true })).toBe("visible_poll_votes");
        expect(kind({ publicVotes: true, hideResults: true })).toBe("hidden_poll_votes");
    });

    test("is stamped to end when it's published", () => {
        expect(newPollContent(newPoll(draft), 5000).config.endDate).toBe(86_405_000n);
    });

    test("locked votes stay locked only for a single-choice poll", () => {
        const config = (d: Partial<PollDraft>) =>
            newPollContent(newPoll({ ...draft, ...d }), 0).config;
        expect(config({ canChange: false }).allowUserToChangeVote).toBe(false);
        expect(config({ canChange: false, multiple: true }).allowUserToChangeVote).toBe(true);
    });
});
