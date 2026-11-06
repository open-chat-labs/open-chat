// The composer's "+" builders (5d) in the library's shapes, and back: what a builder dialog hands
// over, as the client's builders take it.
import type { NewPoll } from "@client";
import type { PollDraft } from "@openchat/ui/src/features/components/PollBuilderDialog.svelte";

/**
 * A poll as `PollBuilderDialog` publishes it, as `newPollContent` takes it: public votes are a poll
 * that isn't anonymous, hidden results one that doesn't show its votes before it ends, and "lock
 * votes" a poll that doesn't let its voters change them (a multiple-choice poll always does).
 */
export function newPoll(draft: PollDraft): NewPoll {
    return {
        question: draft.question,
        answers: draft.options.map((o) => o.label),
        anonymous: !draft.publicVotes,
        showVotesBeforeEndDate: !draft.hideResults,
        allowMultipleVotesPerUser: draft.multiple,
        allowUserToChangeVote: draft.canChange,
        durationMs: draft.durationMs,
    };
}
