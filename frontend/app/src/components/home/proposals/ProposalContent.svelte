<script lang="ts">
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../../stores/rtl";
    import {
        type ChatIdentifier,
        type OpenChat,
        type ProposalContent,
        ProposalDecisionStatus,
        type RegisterProposalVoteResponse,
        currentUser as user,
        proposalTopicsStore,
    } from "openchat-client";
    import Markdown from "../Markdown.svelte";
    import { now } from "../../../stores/time";
    import ExpandIcon from "svelte-material-icons/ArrowExpandDown.svelte";
    import Launch from "svelte-material-icons/Launch.svelte";
    import OpenInNew from "svelte-material-icons/OpenInNew.svelte";
    import { toastStore } from "../../../stores/toast";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { NamedNeurons } from "../../../stores/namedNeurons";
    import { proposalVotes } from "../../../stores/proposalVotes";
    import ProposalVoteButton from "./ProposalVoteButton.svelte";
    import ProposalVotingProgress from "./ProposalVotingProgress.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ProposalProgressLayout from "./ProposalProgressLayout.svelte";
    import { round2 } from "../../../utils/math";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        content: ProposalContent;
        chatId: ChatIdentifier;
        messageIndex: number;
        messageId: bigint;
        collapsed: boolean;
        readonly: boolean;
        reply: boolean;
        onExpandMessage?: () => void;
    }

    let {
        content,
        chatId,
        messageIndex,
        messageId,
        collapsed,
        readonly,
        reply,
        onExpandMessage,
    }: Props = $props();

    const client = getContext<OpenChat>("client");
    const EMPTY_MOTION_PAYLOAD = "# Motion Proposal:\n## Motion Text:\n\n";

    const dashboardUrl = "https://dashboard.internetcomputer.org";

    let summaryExpanded = $state(false);
    let showNeuronInfo = $state(false);
    let showPayload = $state(false);

    function toggleSummary() {
        if (!showFullSummary) {
            summaryExpanded = !summaryExpanded;
        }
    }

    function onVote(adopt: boolean) {
        if (votingDisabled || (chatId.kind !== "group_chat" && chatId.kind !== "channel")) {
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
                    client.getProposalVoteDetails(content.governanceCanisterId, proposal.id, isNns);
                } else if (resp === "no_eligible_neurons") {
                    showNeuronInfo = true;
                } else {
                    const err = registerProposalVoteErrorMessage(resp);
                    if (err) toastStore.showFailureToast(i18nKey("proposal." + err));
                }
            })
            .catch((err) => {
                client.logError("Unable to vote on proposal", err);
                toastStore.showFailureToast(i18nKey("proposal.voteFailed"));
            })
            .finally(() => {
                if (!success) {
                    proposalVotes.delete(mId);
                }
            });
    }

    function registerProposalVoteErrorMessage(
        resp: RegisterProposalVoteResponse,
    ): string | undefined {
        if (resp === "already_voted") return "alreadyVoted";
        if (resp === "proposal_not_accepting_votes") return "proposalNotAcceptingVotes";
        return "voteFailed";
    }

    function onClick() {
        if (collapsed) {
            onExpandMessage?.();
        }
    }

    function renderNeuronId(neuronId: string): string {
        const name = NamedNeurons[neuronId];
        if (name !== undefined) {
            return name;
        }

        const length = neuronId.length;
        if (length < 12) {
            return neuronId;
        }

        return `${neuronId.slice(0, 4)}..${neuronId.slice(length - 4, length)}`;
    }

    export function getProposalTopicLabel(
        content: ProposalContent,
        proposalTopics: Map<number, string>,
    ): string {
        return (
            proposalTopics.get(
                content.proposal.kind === "nns" ? content.proposal.topic : content.proposal.action,
            ) ?? "unknown"
        );
    }
    let rootCanister = $derived(
        client.tryGetNervousSystem(content.governanceCanisterId)?.rootCanisterId ?? "",
    );
    let isNns = $derived(content.proposal.kind === "nns");
    let voteStatus = $derived(
        $proposalVotes.get(messageId) ??
            (content.myVote !== undefined ? (content.myVote ? "adopted" : "rejected") : undefined),
    );
    let proposal = $derived(content.proposal);
    let positive = $derived(
        proposal.status == ProposalDecisionStatus.Adopted ||
            proposal.status == ProposalDecisionStatus.Executed,
    );
    let negative = $derived(
        proposal.status == ProposalDecisionStatus.Failed ||
            proposal.status == ProposalDecisionStatus.Rejected ||
            proposal.status == ProposalDecisionStatus.Unspecified,
    );
    let proposalUrl = $derived(
        isNns
            ? `${dashboardUrl}/proposal/${proposal.id}`
            : `${dashboardUrl}/sns/${rootCanister}/proposal/${proposal.id}`,
    );
    let proposerUrl = $derived(
        isNns
            ? `${dashboardUrl}/neuron/${proposal.proposer}`
            : `${dashboardUrl}/sns/${rootCanister}/neuron/${proposal.proposer}`,
    );
    let adoptPercent = $derived(round2((100 * proposal.tally.yes) / proposal.tally.total));
    let rejectPercent = $derived(round2((100 * proposal.tally.no) / proposal.tally.total));
    let votingEnded = $derived(proposal.deadline <= $now);
    let disable = $derived(readonly || reply || votingEnded);
    let votingDisabled = $derived(voteStatus !== undefined || disable);
    let typeValue = $derived(getProposalTopicLabel(content, $proposalTopicsStore));
    let showFullSummary = $derived(proposal.summary.length < 400);
    let payload = $derived(content.proposal.payloadTextRendering);
    let payloadEmpty = $derived(
        payload === undefined || payload === EMPTY_MOTION_PAYLOAD || payload.length === 0,
    );
    $effect(() => {
        if (collapsed) {
            summaryExpanded = false;
        }
    });
</script>

{#if collapsed}
    <div onclick={onClick}>
        <em>{proposal.title}</em>
        <ExpandIcon viewBox="0 -3 24 24" />
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
            <div class="summary" class:expanded={summaryExpanded} class:full={showFullSummary}>
                <Markdown text={proposal.summary} inline={false} />
            </div>
        {/if}
        <div class="actions">
            {#if !showFullSummary}
                <div class="expand" onclick={toggleSummary}>
                    <div class="label">
                        <Translatable
                            resourceKey={summaryExpanded
                                ? i18nKey("proposal.readless")
                                : i18nKey("proposal.readmore")} />
                    </div>
                    <div class="icon" class:open={summaryExpanded}>
                        <ChevronDown viewBox="0 -3 24 24" size="1.6em" color="var(--icon-txt)" />
                    </div>
                </div>
            {/if}
            {#if !payloadEmpty}
                <div onclick={() => (showPayload = true)} class="payload">
                    <span><Translatable resourceKey={i18nKey("proposal.details")} /></span>
                    <OpenInNew color="var(--icon-txt)" />
                </div>
            {/if}
        </div>

        <ProposalProgressLayout>
            {#snippet adopt()}
                <div class="adopt">
                    <ProposalVoteButton
                        voting={voteStatus === "adopting"}
                        voted={voteStatus === "adopted"}
                        disabled={votingDisabled}
                        mode={"yes"}
                        on:click={() => onVote(true)}
                        percentage={adoptPercent} />
                </div>
            {/snippet}

            {#snippet progress()}
                <div class="progress">
                    <ProposalVotingProgress
                        deadline={proposal.deadline}
                        {votingEnded}
                        {adoptPercent}
                        {rejectPercent}
                        minYesPercentageOfTotal={proposal.minYesPercentageOfTotal}
                        minYesPercentageOfExercised={proposal.minYesPercentageOfExercised} />
                </div>
            {/snippet}

            {#snippet reject()}
                <div class="reject">
                    <ProposalVoteButton
                        voting={voteStatus === "rejecting"}
                        voted={voteStatus === "rejected"}
                        disabled={votingDisabled}
                        mode={"no"}
                        on:click={() => onVote(false)}
                        percentage={rejectPercent} />
                </div>
            {/snippet}
        </ProposalProgressLayout>
    </div>
    <div class="more" class:rtl={$rtlStore}>
        <a href={proposalUrl} rel="noreferrer" target="_blank">{proposal.id}</a>
        <div class="subtitle">
            {typeValue} |
            <Translatable resourceKey={i18nKey("proposal.proposedBy")} />
            <a target="_blank" rel="noreferrer" href={proposerUrl}
                >{renderNeuronId(proposal.proposer)}</a>
        </div>
    </div>
{/if}

{#if showNeuronInfo}
    <Overlay dismissible onClose={() => (showNeuronInfo = false)}>
        <ModalContent compactFooter onClose={() => (showNeuronInfo = false)}>
            {#snippet header()}
                <Translatable resourceKey={i18nKey("proposal.noEligibleNeurons")} />
            {/snippet}
            {#snippet body()}
                <Markdown
                    text={$_("proposal.noEligibleNeuronsMessage", {
                        values: { userId: $user.userId },
                    })} />
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

{#if showPayload && !payloadEmpty}
    <Overlay dismissible onClose={() => (showPayload = false)}>
        <ModalContent compactFooter onClose={() => (showPayload = false)}>
            {#snippet header()}
                <div><Translatable resourceKey={i18nKey("proposal.details")} /></div>
            {/snippet}
            {#snippet body()}
                <div class="payload-body">
                    <Markdown text={payload ?? ""} inline={false} />
                </div>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
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
                border-radius: var(--rd);
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
        color: "inherit";
        background-color: rgba(0, 0, 0, 0.05);
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
        max-height: 65vh;
    }
</style>
