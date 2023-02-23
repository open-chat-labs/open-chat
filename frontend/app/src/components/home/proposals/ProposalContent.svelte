<script lang="ts">
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../../stores/rtl";
    import {
        ProposalContent,
        ProposalDecisionStatus,
        RegisterProposalVoteResponse,
    } from "openchat-client";
    import Markdown from "../Markdown.svelte";
    import { now } from "../../../stores/time";
    import EyeOff from "svelte-material-icons/EyeOff.svelte";
    import Launch from "svelte-material-icons/Launch.svelte";
    import OpenInNew from "svelte-material-icons/OpenInNew.svelte";
    import { toastStore } from "../../../stores/toast";
    import { logger } from "../../../utils/logging";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { proposalVotes } from "../../../stores/proposalVotes";
    import { createEventDispatcher } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ProposalVoteButton from "./ProposalVoteButton.svelte";
    import ProposalVotingProgress from "./ProposalVotingProgress.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ProposalProgressLayout from "./ProposalProgressLayout.svelte";

    const dispatch = createEventDispatcher();

    export let content: ProposalContent;
    export let chatId: string;
    export let messageIndex: number;
    export let messageId: bigint;
    export let collapsed: boolean;
    export let readonly: boolean;
    export let reply: boolean;

    const client = getContext<OpenChat>("client");
    const user = client.user;

    const dashboardUrl = "https://dashboard.internetcomputer.org";
    const nnsDappUrl = "https://nns.ic0.app";

    let summaryExpanded = false;
    let showNeuronInfo = false;
    let showPayload = false;

    $: proposalTopicsStore = client.proposalTopicsStore;
    $: isNns = content.proposal.kind === "nns";
    $: voteStatus =
        $proposalVotes.get(messageId) ??
        (content.myVote !== undefined ? (content.myVote ? "adopted" : "rejected") : undefined);
    $: proposal = content.proposal;
    $: positive =
        proposal.status == ProposalDecisionStatus.Adopted ||
        proposal.status == ProposalDecisionStatus.Executed;
    $: negative =
        proposal.status == ProposalDecisionStatus.Failed ||
        proposal.status == ProposalDecisionStatus.Rejected ||
        proposal.status == ProposalDecisionStatus.Unspecified;
    $: proposalUrl = isNns
        ? `${dashboardUrl}/proposal/${proposal.id}`
        : // TODO FIX THESE SNS LINKS WHEN THEY ARE AVAILABLE
          `${nnsDappUrl}/sns/${content.governanceCanisterId}/proposal/${proposal.id}`;
    $: proposerUrl = isNns
        ? `${dashboardUrl}/neuron/${proposal.proposer}`
        : // TODO FIX THESE SNS LINKS WHEN THEY ARE AVAILABLE
          `${nnsDappUrl}/sns/${content.governanceCanisterId}/neuron/${proposal.proposer}`;
    $: adoptPercent = round2((100 * proposal.tally.yes) / proposal.tally.total);
    $: rejectPercent = round2((100 * proposal.tally.no) / proposal.tally.total);
    $: votingEnded = proposal.deadline <= $now;
    $: disable = readonly || reply || votingEnded;
    $: votingDisabled = voteStatus !== undefined || disable;
    $: typeValue = getProposalTopicLabel(content, $proposalTopicsStore);
    $: showFullSummary = proposal.summary.length < 400;
    $: payload =
        content.proposal.kind === "sns" ? content.proposal.payloadTextRendering : undefined;

    $: {
        if (collapsed) {
            summaryExpanded = false;
        }
    }

    function toggleSummary() {
        if (!showFullSummary) {
            summaryExpanded = !summaryExpanded;
        }
    }

    function onVote(adopt: boolean) {
        if (votingDisabled) {
            return;
        }

        const mId = messageId;
        proposalVotes.insert(mId, adopt ? "adopting" : "rejecting");

        let success = false;
        client
            .registerProposalVote(chatId, messageIndex, adopt)
            .then((resp) => {
                if (resp === "success") {
                    success = true;
                    proposalVotes.insert(mId, adopt ? "adopted" : "rejected");
                } else if (resp === "no_eligible_neurons") {
                    showNeuronInfo = true;
                } else {
                    const err = registerProposalVoteErrorMessage(resp);
                    if (err) toastStore.showFailureToast("proposal." + err);
                }
            })
            .catch((err) => {
                logger.error("Unable to vote on proposal", err);
                toastStore.showFailureToast("proposal.voteFailed");
            })
            .finally(() => {
                if (!success) {
                    proposalVotes.delete(mId);
                }
            });
    }

    function registerProposalVoteErrorMessage(
        resp: RegisterProposalVoteResponse
    ): string | undefined {
        if (resp === "already_voted") return "alreadyVoted";
        if (resp === "proposal_not_accepting_votes") return "proposalNotAcceptingVotes";
        return "voteFailed";
    }

    function round2(num: number): number {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    function onClick() {
        if (collapsed) {
            dispatch("expandMessage");
        }
    }

    function truncatedProposerId(): string {
        if (proposal.proposer.length < 12) {
            return proposal.proposer;
        }

        return `${proposal.proposer.slice(0, 4)}..${proposal.proposer.slice(
            proposal.proposer.length - 4,
            proposal.proposer.length
        )}`;
    }

    export function getProposalTopicLabel(
        content: ProposalContent,
        proposalTopics: Map<number, string>
    ): string {
        return (
            proposalTopics.get(
                content.proposal.kind === "nns" ? content.proposal.topic : content.proposal.action
            ) ?? "unknown"
        );
    }
</script>

{#if collapsed}
    <div on:click={onClick}>
        <em>{proposal.title}</em>
        <EyeOff viewBox="0 -5 24 24" />
    </div>
{:else}
    <div class="wrapper">
        <div class="header">
            <div class="title-block">
                <div class="title">
                    {#if proposal.url.length > 0}
                        <a href={proposal.url} rel="noreferrer" target="_blank"
                            >{proposal.title} <Launch viewBox="0 -1 24 24" /></a>
                    {:else}
                        {proposal.title}
                    {/if}
                </div>
                <div class="status" class:positive class:negative>
                    {ProposalDecisionStatus[proposal.status]}
                </div>
            </div>
        </div>

        {#if proposal.summary.length > 0}
            <div
                class="summary"
                class:expanded={summaryExpanded}
                class:full={showFullSummary}
                on:click={toggleSummary}>
                <Markdown text={proposal.summary} inline={false} />
            </div>
            <div class="actions">
                {#if !showFullSummary}
                    <div class="expand" on:click={toggleSummary}>
                        <div class="label">
                            {summaryExpanded ? $_("proposal.readless") : $_("proposal.readmore")}
                        </div>
                        <div class="icon" class:open={summaryExpanded}>
                            <ChevronDown
                                viewBox="0 -3 24 24"
                                size="1.6em"
                                color="var(--icon-txt)" />
                        </div>
                    </div>
                {/if}
                {#if payload !== undefined}
                    <div on:click={() => (showPayload = true)} class="payload">
                        <span>{$_("proposal.payload")}</span>
                        <OpenInNew color="var(--icon-txt)" />
                    </div>
                {/if}
            </div>
        {/if}

        <ProposalProgressLayout>
            <div slot="adopt" class="adopt">
                <ProposalVoteButton
                    voting={voteStatus === "adopting"}
                    voted={voteStatus === "adopted"}
                    disabled={votingDisabled}
                    mode={"yes"}
                    on:click={() => onVote(true)}
                    percentage={adoptPercent} />
            </div>

            <div slot="progress" class="progress">
                <ProposalVotingProgress
                    deadline={proposal.deadline}
                    {votingEnded}
                    {adoptPercent}
                    {rejectPercent} />
            </div>

            <div slot="reject" class="reject">
                <ProposalVoteButton
                    voting={voteStatus === "rejecting"}
                    voted={voteStatus === "rejected"}
                    disabled={votingDisabled}
                    mode={"no"}
                    on:click={() => onVote(false)}
                    percentage={rejectPercent} />
            </div>
        </ProposalProgressLayout>
    </div>
    <div class="more" class:rtl={$rtlStore}>
        {#if isNns}
            <a href={proposalUrl} rel="noreferrer" target="_blank">{proposal.id}</a>
        {:else}
            {proposal.id}
        {/if}
        <div class="subtitle">
            {typeValue} |
            {$_("proposal.proposedBy")}
            {#if isNns}
                <a target="_blank" rel="noreferrer" href={proposerUrl}>{truncatedProposerId()}</a>
            {:else}
                {truncatedProposerId()}
            {/if}
        </div>
    </div>
{/if}

{#if showNeuronInfo}
    <Overlay dismissible>
        <ModalContent compactFooter on:close={() => (showNeuronInfo = false)}>
            <div slot="header">{$_("proposal.noEligibleNeurons")}</div>
            <div slot="body">
                {$_("proposal.noEligibleNeuronsMessage")}
                <br /><br />
                <div class="value">{user.userId}</div>
            </div>
        </ModalContent>
    </Overlay>
{/if}

{#if showPayload && payload !== undefined}
    <Overlay dismissible>
        <ModalContent compactFooter on:close={() => (showPayload = false)}>
            <div slot="header">{$_("proposal.payload")}</div>
            <div class="payload-body" slot="body">
                <Markdown text={payload} inline={false} />
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    .header {
        margin-bottom: toRem(4);

        .title-block {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: $sp4;
            gap: $sp3;
            .title {
                @include font(bold, normal, fs-120, 22);
                word-break: break-all;

                a {
                    display: flex;
                    gap: $sp2;
                    align-items: center;
                    width: fit-content;
                }
            }
            .status {
                border-radius: $sp2;
                padding: toRem(1) toRem(6);
                height: fit-content;
                color: white;
                background-color: var(--vote-maybe-color);

                &.positive {
                    background-color: var(--vote-yes-color);
                }

                &.negative {
                    background-color: var(--vote-no-color);
                }
            }
        }
    }

    .summary {
        transition: none;
        max-height: toRem(72);
        @include nice-scrollbar();
        overflow-y: auto;
        cursor: pointer;
        position: relative;
        overflow-x: hidden;
        color: var(--markdown-fg-color);
        background-color: rgba(0, 0, 0, 0.1);
        padding: $sp3;

        &.expanded {
            transition: max-height ease-in 200ms;
            max-height: toRem(360);
        }

        &.full {
            max-height: none;
            cursor: default;
        }
    }

    .value {
        @include font-size(fs-120);
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
    }

    .progress {
        flex: auto;
        width: 100%;
    }

    .more {
        margin-top: $sp2;
        @include font-size(fs-70);
        float: left;
        display: flex;
        gap: $sp3;
        &.rtl {
            float: right;
        }

        .subtitle {
            @include font(book, normal, fs-70);
            font-weight: 700;
            @include font-size(fs-70);
        }
    }

    .expand {
        font-weight: 700;
        display: flex;
        align-items: center;

        .label {
            min-width: 70px;
        }

        .icon {
            transition: transform 200ms ease-in-out;
            transform-origin: 50%;
            &.open {
                transform: rotate(180deg);
            }
        }
    }

    .actions {
        margin-top: $sp3;
        cursor: pointer;
        @include font(book, normal, fs-80);
        display: flex;
        align-items: center;
        gap: $sp4;
    }

    .payload {
        display: flex;
        align-items: center;
        gap: $sp2;
    }

    .payload-body {
        word-wrap: break-word;
    }
</style>
