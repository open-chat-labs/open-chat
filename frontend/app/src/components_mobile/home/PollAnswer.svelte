<script lang="ts">
    import { Body, ColourVars, Row, Tooltip } from "component-lib";
    import type { OpenChat, UserLookup } from "openchat-client";
    import { allUsersStore, currentUserIdStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import Progress from "../Progress.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
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

    let { percent, answer, voted, txtColor, voters, numVotes, showVotes, onClick }: Props =
        $props();

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
    let usernames = $derived(buildPollUsernames($allUsersStore, voters, $currentUserIdStore));
</script>

<Tooltip
    textLength={usernames === undefined ? 10 : usernames.length + 16}
    longestWord={30}
    position={"right"}
    align={"middle"}
    fill
    enable={showVotes}>
    <Row onClick={click}>
        <Progress colour={ColourVars.primaryMuted} {percent}>
            <Row gap={"md"} crossAxisAlignment={"center"}>
                <Body width={"hug"}>
                    {answer}
                </Body>
                {#if voted}
                    <CheckCircleOutline size={"1em"} color={txtColor} />
                {/if}
            </Row>
        </Progress>
    </Row>
    {#snippet popup()}
        {buildTooltipText()}
    {/snippet}
</Tooltip>
