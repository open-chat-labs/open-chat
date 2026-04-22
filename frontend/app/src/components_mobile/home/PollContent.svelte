<script lang="ts">
    import {
        BodySmall,
        Caption,
        ChatText,
        ChatCaption,
        ColourVars,
        Column,
        Row,
    } from "component-lib";
    import { currentUserIdStore, publish, type OpenChat, type PollContent } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import ChartBoxOutline from "svelte-material-icons/ChartBoxOutline.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircle.svelte";
    import CheckboxBlankCircleOutline from "svelte-material-icons/CheckboxBlankCircleOutline.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: PollContent;
        me: boolean;
        readonly: boolean;
        senderId: string;
        reply?: boolean;
        edited?: boolean;
        blockLevelMarkdown?: boolean;
        title?: Snippet;
        onRemove?: () => void;
        onRegisterVote?: (vote: { type: "delete" | "register"; answerIndex: number }) => void;
    }

    let {
        content,
        me,
        readonly,
        senderId,
        reply = false,
        edited = false,
        blockLevelMarkdown = false,
        title,
        onRemove,
        onRegisterVote,
    }: Props = $props();

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

    function viewPublicVotes() {
        publish("pollPublicVotes", { content, senderId });
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
        const answerVotes = votesForAnswer(idx);
        return showVotes && answerVotes > 0 ? (votesForAnswer(idx) / numberOfVotes) * 100 : 0;
    }

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

    type ShortStatusKeys = {
        visibility: string;
        voteType: string;
        voteEdit: string;
        viewResults: string | undefined;
    };

    // Internationalisation required here, and in the component layout.
    let shortStatus = $derived.by<ShortStatusKeys>(() => {
        return {
            visibility: content.config.anonymous
                ? "poll.app.votesAreAnon"
                : "poll.app.votesArePublic",
            voteType: content.config.allowMultipleVotesPerUser
                ? "poll.app.multiVote"
                : "poll.app.singleVote",
            voteEdit: content.config.allowUserToChangeVote
                ? "poll.app.canChangeVote"
                : "poll.app.cantChangeVote",
            viewResults: content.config.showVotesBeforeEndDate
                ? undefined
                : "poll.app.resultsWillShow",
        };
    });
</script>

{#snippet replyView(textContent?: Snippet)}
    <Column gap="xxs">
        <Row>{@render title?.()}</Row>
        <Row gap="xs" crossAxisAlignment="center">
            <ChartBoxOutline
                size="1rem"
                color={me ? ColourVars.secondaryLight : ColourVars.primaryLight} />
            {@render textContent?.()}
        </Row>
    </Column>
{/snippet}

{#snippet regularView()}
    <Column padding={["zero", "zero", "lg"]} gap="sm">
        <!-- Poll question and setup -->
        <Row
            gap="sm"
            padding="md"
            overflow="hidden"
            background={me ? ColourVars.primaryMuted : ColourVars.background0}
            borderRadius={[me ? "lg" : "md", me ? "md" : "lg", "lg", "lg"]}>
            <Poll size="2rem" color={me ? ColourVars.primaryLight : ColourVars.textSecondary} />
            <Column gap="sm">
                <ChatText fontWeight="bold">{content.config?.text ?? "..."}</ChatText>
                <ChatCaption colour="primaryLight">
                    <Translatable resourceKey={i18nKey(shortStatus.visibility)} /> •
                    <Translatable resourceKey={i18nKey(shortStatus.voteType)} /> •
                    <Translatable resourceKey={i18nKey(shortStatus.voteEdit)} />
                    {#if shortStatus.viewResults}
                        • <Translatable resourceKey={i18nKey(shortStatus.viewResults)} />
                    {/if}
                </ChatCaption>
            </Column>
        </Row>

        <!-- Answers list -->
        <Column padding={["sm", "md"]} gap="xl">
            {#each [...content.config.options] as answer, i (answer)}
                {@const voted = votedFor(i)}
                {@const pct = percentageOfVote(i)}
                {@const pctSingleDec = Math.round(pct * 10) / 10}
                <Column gap="sm" onClick={() => vote(i)}>
                    <Row gap="sm" padding={["zero", "xs"]} crossAxisAlignment="center">
                        <BodySmall width={{ size: "2.1rem" }} colour="primaryLight">
                            {#if showVotes}
                                {`${pctSingleDec}%`}
                            {:else}
                                %
                            {/if}
                        </BodySmall>
                        <ChatText>{answer}</ChatText>
                        {#if voted}
                            <CheckCircleOutline size="1.25rem" color={ColourVars.textPrimary} />
                        {:else}
                            <CheckboxBlankCircleOutline
                                size="1.25rem"
                                color={me ? ColourVars.primaryLight : ColourVars.textSecondary} />
                        {/if}
                    </Row>
                    <div class="progress" class:me>
                        <div class="pct" style:width={showVotes ? `${pct}%` : "0%"}></div>
                    </div>
                </Column>
            {/each}
        </Column>

        <!-- Info & Poll Options -->
        <Column gap="xs" padding={["xs", "lg", "zero"]} crossAxisAlignment="start">
            <Row height={{ size: "1rem" }} crossAxisAlignment="center" overflow="hidden">
                <ChatCaption>
                    <Translatable
                        resourceKey={i18nKey("poll.totalVotes", {
                            total: numberOfVotes.toString(),
                        })} />
                </ChatCaption>

                {#if !content.config.anonymous && showVotes}
                    <button class="view_votes" onclick={viewPublicVotes}>
                        <ChatCaption colour="textPrimary" fontWeight="bold">View votes</ChatCaption>
                    </button>
                {/if}
            </Row>

            <Caption colour={me ? "primaryLight" : "textSecondary"}>
                {#if content.ended}
                    <Translatable resourceKey={i18nKey("poll.finished")} />
                {:else if date}
                    <Translatable
                        resourceKey={i18nKey("poll.pollEnds", {
                            end: `${client.toLongDateString(date)} @ ${client.toShortTimeString(
                                date,
                            )}`,
                        })} />
                {/if}
            </Caption>
        </Column>
    </Column>
{/snippet}

<MessageRenderer
    caption={content.config.text}
    {replyView}
    {regularView}
    {me}
    {reply}
    {edited}
    {blockLevelMarkdown}
    {onRemove} />

<style lang="scss">
    .progress,
    .pct {
        border-radius: var(--rad-lg);
    }

    .progress.me {
        background-color: var(--primary-muted);
    }

    .progress:not(.me) {
        background-color: var(--background-0);
    }

    .progress {
        height: 0.5rem;
        width: 100%;
    }

    .pct {
        height: 100%;
        background-color: var(--text-primary);
        transition: width 200ms ease-out;
    }

    .view_votes {
        background: transparent;
        border: none;
        padding: var(--sp-sm) var(--sp-zero) var(--sp-sm);
    }
</style>
