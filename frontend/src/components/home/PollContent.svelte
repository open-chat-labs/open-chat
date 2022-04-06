<!-- <svelte:options immutable={true} /> -->
<script lang="ts">
    import Poll from "svelte-material-icons/Poll.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import Progress from "../Progress.svelte";
    import { _ } from "svelte-i18n";
    import type { PollContent } from "../../domain/chat/chat";
    import { iconSize } from "../../stores/iconSize";
    import { toLongDateString, toShortTimeString } from "../../utils/date";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let content: PollContent;
    export let me: boolean;
    export let preview: boolean;

    $: txtColor = me ? "var(--currentChat-msg-me-txt)" : "var(--currentChat-msg-txt)";

    $: date = content.config.endDate ? new Date(Number(content.config.endDate)) : undefined;

    $: haveIVoted = content.votes.user.length > 0;

    $: numberOfVotes = totalVotes(content);

    function vote(idx: number) {
        if (content.ended || preview) return;

        dispatch("registerVote", {
            type: votedFor(idx) ? "delete" : "register",
            answerIndex: idx,
        });
    }

    function votedFor(idx: number): boolean {
        return content.votes.user.includes(idx);
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
                0
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
        const showPercentage =
            content.ended ||
            (haveIVoted &&
                (content.config.showVotesBeforeEndDate || content.config.endDate === undefined));

        return showPercentage ? (votesForAnswer(idx) / numberOfVotes) * 100 : 0;
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
            <div
                class:preview
                class="answer-text"
                class:finished={content.ended}
                on:click={() => vote(i)}>
                <Progress bg={"button"} percent={percentageOfVote(i)}>
                    <div class="label">
                        <span>{answer}</span>
                        {#if votedFor(i)}
                            <CheckCircleOutline size={"1em"} color={txtColor} />
                        {/if}
                    </div>
                </Progress>
            </div>
        {/each}
    </div>
    <p class="total-votes">
        {$_("poll.totalVotes", { values: { total: numberOfVotes.toString() } })}
    </p>
    {#if date !== undefined}
        <p class="timestamp">
            {#if content.ended}
                {$_("poll.finished")}
            {:else}
                {$_("poll.pollEnds", {
                    values: { end: `${toLongDateString(date)} @ ${toShortTimeString(date)}` },
                })}
            {/if}
        </p>
    {/if}
</div>

<style type="text/scss">
    .poll {
        @include size-above(sm) {
            min-width: 300px;
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

    .label {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .answers {
        margin-bottom: $sp3;
    }

    .answer-text {
        padding: $sp3 0;
        cursor: pointer;

        &.finished {
            cursor: default;
        }

        &.preview {
            cursor: default;
        }
    }

    .total-votes {
        @include font(bold, normal, fs-70);
    }

    .timestamp {
        @include font(light, normal, fs-70);
    }
</style>
