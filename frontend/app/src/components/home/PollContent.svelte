<!-- <svelte:options immutable /> -->
<script lang="ts">
    import Poll from "svelte-material-icons/Poll.svelte";
    import type { OpenChat, PollContent } from "openchat-client";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, getContext } from "svelte";
    import PollAnswer from "./PollAnswer.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let content: PollContent;
    export let me: boolean;
    export let myUserId: string | undefined;
    export let readonly: boolean;
    export let senderId: string;

    $: txtColor = me ? "#ffffff" : "var(--txt)";

    $: date = content.config.endDate ? new Date(Number(content.config.endDate)) : undefined;

    $: haveIVoted = content.votes.user.length > 0;

    $: numberOfVotes = totalVotes(content);

    $: cannotVote =
        content.ended || readonly || (haveIVoted && !content.config.allowUserToChangeVote);

    $: showVotes =
        content.ended ||
        ((haveIVoted || senderId === myUserId) &&
            (content.config.showVotesBeforeEndDate || content.config.endDate === undefined));

    function vote(idx: number) {
        if (cannotVote) return;

        dispatch("registerVote", {
            type: votedFor(idx) ? "delete" : "register",
            answerIndex: idx,
        });
    }

    function votedFor(idx: number): boolean {
        return content.votes.user.includes(idx);
    }

    function voteCount(idx: number): number {
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

    function voters(idx: number): string[] | undefined {
        if (content.votes.total.kind !== "visible_poll_votes") {
            return undefined;
        }

        return content.votes.total.votes[idx];
    }

    function totalVotes(content: PollContent): number {
        if (content.votes.total.kind === "anonymous_poll_votes") {
            return Object.values(content.votes.total.votes).reduce((total, n) => total + n, 0);
        }
        if (content.votes.total.kind === "hidden_poll_votes") {
            return content.votes.total.votes;
        }
        if (content.votes.total.kind === "visible_poll_votes") {
            return Object.values(content.votes.total.votes).reduce(
                (total, n) => total + n.length,
                0,
            );
        }
        return 0;
    }

    function votesForAnswer(idx: number): number {
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

    function percentageOfVote(idx: number) {
        return showVotes ? (votesForAnswer(idx) / numberOfVotes) * 100 : 0;
    }
</script>

<div class="poll">
    {#if content.config.text !== undefined}
        <div class="question">
            <div class="icon">
                <Poll size={$iconSize} color={txtColor} />
            </div>
            <p class="question-txt">{content.config.text}</p>
        </div>
    {/if}
    <div class="answers">
        {#each [...content.config.options] as answer, i (answer)}
            <PollAnswer
                onClick={() => vote(i)}
                finished={content.ended}
                {readonly}
                percent={percentageOfVote(i)}
                {answer}
                voted={votedFor(i)}
                {txtColor}
                {myUserId}
                {me}
                voters={voters(i)}
                numVotes={voteCount(i)}
                {showVotes} />
        {/each}
    </div>
    <p class="total-votes">
        <Translatable
            resourceKey={i18nKey("poll.totalVotes", { total: numberOfVotes.toString() })} />
    </p>
    <p class="timestamp">
        {#if content.config.anonymous}
            <Translatable resourceKey={i18nKey("poll.votersPrivate")} />
        {:else}
            <Translatable resourceKey={i18nKey("poll.votersPublic")} />
        {/if}
    </p>
    {#if date !== undefined}
        <p class="timestamp">
            {#if content.ended}
                <Translatable resourceKey={i18nKey("poll.finished")} />
            {:else}
                <Translatable
                    resourceKey={i18nKey("poll.pollEnds", {
                        end: `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`,
                    })} />
            {/if}
        </p>
    {/if}
</div>

<style lang="scss">
    .poll {
        @include size-above(sm) {
            min-width: 240px;
        }
    }

    .question {
        display: flex;
        align-items: flex-start;
        .question-txt {
            @include font(bold, normal, fs-110);
        }
        .icon {
            flex: 0 0 30px;
        }
    }

    .answers {
        margin: $sp3 0 $sp4 0;
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .total-votes {
        @include font(bold, normal, fs-70);
    }

    .timestamp {
        @include font(light, normal, fs-70);
    }
</style>
