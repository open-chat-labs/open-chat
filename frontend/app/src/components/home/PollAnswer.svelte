<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import Progress from "../Progress.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import type { OpenChat, UserLookup } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let finished: boolean;
    export let readonly: boolean;
    export let percent: number;
    export let answer: string;
    export let voted: boolean;
    export let txtColor: string;
    export let myUserId: string | undefined;
    export let voters: string[] | undefined;
    export let numVotes: number;
    export let showVotes: boolean;

    $: userStore = client.userStore;
    $: usernames = buildPollUsernames($userStore, voters, myUserId);

    function buildPollUsernames(
        userStore: UserLookup,
        voters: string[] | undefined,
        myUserId: string | undefined
    ): string | undefined {
        if (voters === undefined || voters.length === 0 || !showVotes) return undefined;
        return client.buildUsernameList($_, new Set(voters), myUserId, userStore);
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

<TooltipWrapper position={"right"} align={"center"} enable={showVotes}>
    <div slot="target" class:readonly class="answer-text" class:finished on:click>
        <Progress bg={"button"} {percent}>
            <div class="label">
                <span>{answer}</span>
                {#if voted}
                    <CheckCircleOutline size={"1em"} color={txtColor} />
                {/if}
            </div>
        </Progress>
    </div>
    <div let:position let:align slot="tooltip">
        <TooltipPopup
            {position}
            {align}
            textLength={usernames === undefined ? 10 : usernames.length + 16}
            longestWord={30}>
            {buildTooltipText()}
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style lang="scss">
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

        &.readonly {
            cursor: default;
        }
    }
</style>
