<script lang="ts">
    import {
        currentUserIdStore,
        getVotersForAnswer,
        iconSize,
        percentageOfVote,
        pollView,
        totalVotes,
        voteCount,
        type OpenChat,
        type PollContent,
    } from "@client";
    import { getContext } from "svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";
    import PollAnswer from "./PollAnswer.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: PollContent;
        me: boolean;
        readonly: boolean;
        senderId: string;
        onRegisterVote?: (vote: { type: "delete" | "register"; answerIndex: number }) => void;
    }

    let { content, me, readonly, senderId, onRegisterVote }: Props = $props();

    function vote(idx: number) {
        if (cannotVote) return;

        onRegisterVote?.({
            type: votedFor(idx) ? "delete" : "register",
            answerIndex: idx,
        });
    }

    function votedFor(idx: number): boolean {
        return content.votes.user.includes(idx);
    }

    // the moved helper guards a poll with no votes (0%, not NaN)
    function percent(idx: number) {
        return showVotes ? percentageOfVote(content, idx) : 0;
    }
    let txtColor = $derived(me ? "#ffffff" : "var(--txt)");
    let date = $derived(
        content.config.endDate ? new Date(Number(content.config.endDate)) : undefined,
    );
    let numberOfVotes = $derived(totalVotes(content));
    // a DM's poll can't be voted on either; ChatMessage's onRegisterVote refuses it
    let view = $derived(
        pollView(content, { me: $currentUserIdStore, sender: senderId, direct: false, readonly }),
    );
    let cannotVote = $derived(view.cannotVote);
    let showVotes = $derived(view.showVotes);
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
                percent={percent(i)}
                {answer}
                voted={votedFor(i)}
                {txtColor}
                {me}
                voters={getVotersForAnswer(content, i)}
                numVotes={voteCount(content, i)}
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
