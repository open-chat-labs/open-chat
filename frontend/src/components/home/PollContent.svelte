<svelte:options immutable={true} />

<script lang="ts">
    import Poll from "svelte-material-icons/Poll.svelte";
    import { config } from "process";
    import Progress from "../Progress.svelte";
    import { _ } from "svelte-i18n";
    import type { PollContent } from "../../domain/chat/chat";
    import { userStore } from "../../stores/user";
    import { iconSize } from "../../stores/iconSize";
    import { toLongDateString, toShortTimeString } from "../../utils/date";

    export let content: PollContent;
    export let userId: string;

    $: date = content.config.endDate ? new Date(Number(content.config.endDate)) : undefined;

    $: canVote = false;

    function vote(idx: number) {
        console.log("voted for ", idx);
    }
</script>

<div class="poll">
    {#if content.config.text !== undefined}
        <div class="question">
            <div class="icon">
                <Poll size={$iconSize} color={"#fff"} />
            </div>
            <p class="question-txt">{content.config.text}</p>
        </div>
    {/if}
    <div class="answers">
        {#each [...content.config.options] as answer, i (answer)}
            <div class="answer-text" on:click={() => vote(i)}>
                <Progress label={answer} bg={"accent"} percent={i * 10} />
            </div>
        {/each}
    </div>
    {#if date !== undefined}
        <p class="timestamp">
            {$_("poll.pollEnds", {
                values: { end: `${toLongDateString(date)} @ ${toShortTimeString(date)}` },
            })}
        </p>
    {/if}
</div>

<style type="text/scss">
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
        margin-bottom: $sp3;
    }

    .answer-text {
        padding: $sp3 0;
        min-width: 300px;
    }

    .timestamp {
        @include font(light, normal, fs-70);
    }
</style>
