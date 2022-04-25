<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import Progress from "../Progress.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import type { UserLookup } from "../../domain/user/user";
    import { buildUsernameList } from "../../domain/user/user.utils";
    import { getContext } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import TooltipWrapper from "../TooltipWrapper.svelte";

    export let finished: boolean;
    export let preview: boolean;
    export let percent: number;
    export let answer: string;
    export let voted: boolean;
    export let txtColor: string;
    export let myUserId: string | undefined;
    export let voters: string[] | undefined;
    export let numVotes: number;
    export let showVotes: boolean;
    export let me: boolean;

    let userLookup = getContext<UserLookup>("userLookup");

    $: usernames = buildPollUsernames(voters, myUserId);
    $: alignRight = me != $rtlStore;

    function buildPollUsernames(
        voters: string[] | undefined,
        myUserId: string | undefined
    ): string | undefined {
        if (voters === undefined || voters.length === 0) return undefined;
        return buildUsernameList(new Set(voters), myUserId, userLookup);
    }

    function buildTooltipText(): string {
        if (usernames === undefined) {
            if (numVotes === 1) {
                if (voted) {
                    return $_("poll.oneVoteBy") + " " + $_("you");
                } else {
                    return $_("poll.oneVote");
                }
            } else {
                if (voted) {
                    return $_("poll.numVotesIncludingYours", { values: { votes: numVotes } });
                } else {
                    return $_("poll.numVotes", { values: { votes: numVotes } });
                }
            }
        } else {
            if (numVotes === 1) {
                return $_("poll.oneVoteBy") + " " + usernames;
            } else {
                return $_("poll.numVotesBy", { values: { votes: numVotes } }) + " " + usernames;
            }
        }
    }
</script>

<TooltipWrapper enable={showVotes} {alignRight} bottomOffset={4}>
    <div slot="target" class:preview class="answer-text" class:finished on:click>
        <Progress bg={"button"} {percent}>
            <div class="label">
                <span>{answer}</span>
                {#if voted}
                    <CheckCircleOutline size={"1em"} color={txtColor} />
                {/if}
            </div>
        </Progress>
    </div>
    <div slot="tooltip">
        <TooltipPopup
            textLength={usernames === undefined ? 10 : usernames.length + 16}
            longestWord={30}
            {alignRight}>
            <div class="tooltip-body">
                {buildTooltipText()}
            </div>
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style type="text/scss">
    .label {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .answer-text {
        cursor: pointer;

        &.finished {
            cursor: default;
        }

        &.preview {
            cursor: default;
        }
    }

    .tooltip-body {
        color: black;
    }
</style>
