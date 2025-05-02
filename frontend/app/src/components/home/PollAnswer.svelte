<script lang="ts">
    import type { OpenChat, UserLookup } from "openchat-client";
    import { app, userStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import Progress from "../Progress.svelte";
    import Tooltip from "../tooltip/Tooltip.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        finished: boolean;
        readonly: boolean;
        percent: number;
        answer: string;
        voted: boolean;
        txtColor: string;
        voters: string[] | undefined;
        numVotes: number;
        showVotes: boolean;
        me: boolean;
        onClick?: () => void;
    }

    let {
        finished,
        readonly,
        percent,
        answer,
        voted,
        txtColor,
        voters,
        numVotes,
        showVotes,
        me,
        onClick,
    }: Props = $props();

    let longPressed: boolean = $state(false);

    function buildPollUsernames(
        userStore: UserLookup,
        voters: string[] | undefined,
        myUserId: string | undefined,
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

    function click() {
        if (!longPressed) {
            onClick?.();
        }
    }
    let usernames = $derived(buildPollUsernames($userStore, voters, app.currentUserId));
</script>

<Tooltip
    textLength={usernames === undefined ? 10 : usernames.length + 16}
    longestWord={30}
    bind:longPressed
    position={"right"}
    align={"middle"}
    enable={showVotes}>
    <div class:readonly class="answer-text" class:finished onclick={click}>
        <Progress bg={me ? "accent" : "button"} {percent}>
            <div class="label">
                <span>{answer}</span>
                {#if voted}
                    <CheckCircleOutline size={"1em"} color={txtColor} />
                {/if}
            </div>
        </Progress>
    </div>
    {#snippet popupTemplate()}
        {buildTooltipText()}
    {/snippet}
</Tooltip>

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
