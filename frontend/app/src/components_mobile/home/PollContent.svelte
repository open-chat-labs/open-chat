<script lang="ts">
    import { Body, BodySmall, ColourVars, Column, Row } from "component-lib";
    import { currentUserIdStore, type OpenChat, type PollContent } from "openchat-client";
    import { getContext } from "svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
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
    let txtColor = $derived(me ? "#ffffff" : "var(--txt)");
    let date = $derived(
        content.config.endDate ? new Date(Number(content.config.endDate)) : undefined,
    );
    let haveIVoted = $derived(content.votes.user.length > 0);
    let numberOfVotes = $derived(totalVotes(content));
    let cannotVote = $derived(
        content.ended || readonly || (haveIVoted && !content.config.allowUserToChangeVote),
    );
    let showVotes = $derived(
        content.ended ||
            ((haveIVoted || senderId === $currentUserIdStore) &&
                (content.config.showVotesBeforeEndDate || content.config.endDate === undefined)),
    );
</script>

<Column gap={"lg"}>
    {#if content.config.text !== undefined}
        <Row gap={"md"} crossAxisAlignment={"center"}>
            <Poll color={ColourVars.textPrimary} />
            <Body fontWeight={"bold"}>
                {content.config.text}
            </Body>
        </Row>
    {/if}
    {#each [...content.config.options] as answer, i (answer)}
        <PollAnswer
            onClick={() => vote(i)}
            percent={percentageOfVote(i)}
            {answer}
            voted={votedFor(i)}
            {txtColor}
            {me}
            voters={voters(i)}
            numVotes={voteCount(i)}
            {showVotes} />
    {/each}
    <Column>
        <Body fontWeight={"bold"}>
            <Translatable
                resourceKey={i18nKey("poll.totalVotes", { total: numberOfVotes.toString() })} />
        </Body>
        <BodySmall>
            {#if content.config.anonymous}
                <Translatable resourceKey={i18nKey("poll.votersPrivate")} />
            {:else}
                <Translatable resourceKey={i18nKey("poll.votersPublic")} />
            {/if}
        </BodySmall>
        {#if date !== undefined}
            <BodySmall>
                {#if content.ended}
                    <Translatable resourceKey={i18nKey("poll.finished")} />
                {:else}
                    <Translatable
                        resourceKey={i18nKey("poll.pollEnds", {
                            end: `${client.toLongDateString(date)} @ ${client.toShortTimeString(
                                date,
                            )}`,
                        })} />
                {/if}
            </BodySmall>
        {/if}
    </Column>
</Column>
