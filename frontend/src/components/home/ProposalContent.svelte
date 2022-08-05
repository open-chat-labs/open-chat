<script lang="ts">
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import {
        nnsProposalTopicLabels,
        ProposalContent,
        ProposalDecisionStatus,
        RegisterProposalVoteResponse,
        SnsProposalAction,
    } from "../../domain/chat/chat";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import Markdown from "./Markdown.svelte";
    import { now, now500 } from "../../stores/time";
    import { formatTimeRemaining } from "../../utils/time";
    import { toDateString, toShortTimeString } from "../../utils/date";
    import EyeOff from "svelte-material-icons/EyeOff.svelte";
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Launch from "svelte-material-icons/Launch.svelte";
    import { toastStore } from "../../stores/toast";
    import { rollbar } from "../../utils/logging";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { currentUserStore } from "../../stores/chat";
    import { proposalVotes } from "../../stores/proposalVotes";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let content: ProposalContent;
    export let chatId: string;
    export let messageIndex: number;
    export let messageId: bigint;
    export let collapsed: boolean;
    export let preview: boolean;
    export let reply: boolean;

    const api: ServiceContainer = getContext(apiKey);

    const dashboardUrl = "https://dashboard.internetcomputer.org";

    let summaryExpanded = false;
    let showNeuronInfo = false;

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
    $: dashboardProposalUrl = `${dashboardUrl}/proposal/${proposal.id}`;
    $: dashboardNeuronUrl = `${dashboardUrl}/neuron/${proposal.proposer}`;
    $: adoptPercent = round2((100 * proposal.tally.yes) / proposal.tally.total);
    $: rejectPercent = round2((100 * proposal.tally.no) / proposal.tally.total);
    $: deadline = new Date(Number(proposal.deadline));
    $: votingEnded = proposal.deadline <= $now;
    $: disable = preview || reply || votingEnded;
    $: votingDisabled = voteStatus !== undefined || disable;
    $: isNns = content.proposal.kind === "nns";
    $: typeLabel = $_(isNns ? "proposal.topic" : "proposal.action");
    $: typeValue =
        proposal.kind === "nns"
            ? nnsProposalTopicLabels[proposal.topic]
            : SnsProposalAction[proposal.action];
    $: rtl = $rtlStore ? "right" : "left";
    $: user = $currentUserStore!;
    $: showFullSummary = proposal.summary.length < 400;

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
        api.registerProposalVote(chatId, messageIndex, adopt)
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
                rollbar.error("Unable to vote on proposal", err);
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
</script>

{#if collapsed}
    <div on:click={onClick}>
        <em>{proposal.title}</em>
        <EyeOff viewBox="0 -5 24 24" />
    </div>
{:else}
    <div>
        <div class="header">
            <div class="title-block">
                <div class="title">
                    {#if proposal.url.length > 0}
                        <a href={proposal.url} target="_blank"
                            >{proposal.title} <Launch viewBox="0 -1 24 24" /></a>
                    {:else}
                        {proposal.title}
                    {/if}
                </div>
                <div class="subtitle">
                    {typeLabel}: {typeValue} |
                    <span
                        >{$_("proposal.proposedBy")}{#if !isNns}:{/if}</span>
                    {#if isNns}
                        <a target="_blank" href={dashboardNeuronUrl}>{proposal.proposer}</a>
                    {:else}
                        <span>{proposal.proposer}</span>
                    {/if}
                </div>
            </div>
            <div class="status" class:positive class:negative>
                {ProposalDecisionStatus[proposal.status]}
            </div>
        </div>

        {#if proposal.summary.length > 0}
            <div
                class="summary"
                class:expanded={summaryExpanded}
                class:full={showFullSummary}
                on:click={toggleSummary}>
                <Markdown text={proposal.summary} inline={false} />
                {#if !showFullSummary}
                    <div class="gradient" />
                {/if}
            </div>
        {/if}

        <div class="votes" class:rtl={$rtlStore}>
            <div class="data">
                <div class="yes">
                    <span class="label">{$_("yes")}</span>
                    <span class="value">{adoptPercent}%</span>
                </div>
                <div class="no">
                    <span class="label">{$_("no")}</span>
                    <span class="value">{rejectPercent}%</span>
                </div>
                <div class="remaining">
                    {#if !votingEnded}
                        <span class="label">{$_("proposal.votingPeriodRemaining")}</span>
                        <span class="value">{formatTimeRemaining($now500, proposal.deadline)}</span>
                    {:else}
                        <span class="label">{$_("proposal.votingPeriodEnded")}</span>
                        <span class="value"
                            >{toDateString(deadline)} {toShortTimeString(deadline)}</span>
                    {/if}
                </div>
            </div>
            <div class="progress">
                <div class="adopt" style="width: {adoptPercent}%" />
                <div class="reject" style="width: {rejectPercent}%" />
                <div class="vertical-line" style="{rtl}: 3%" />
                <div class="vertical-line" style="{rtl}: 50%" />
                <div class="icon" style="{rtl}: calc(3% - 0.5em)">
                    <ChevronDown viewBox="-1 0 24 24" />
                </div>
                <div class="icon solid" style="{rtl}: calc(50% - 0.5em)">
                    <svg viewBox="-1 0 24 24">
                        <path d="M6,10 L12,16 L18,10 H7Z" fill="currentColor" />
                    </svg>
                </div>
            </div>
        </div>

        <div class="vote" class:voted={voteStatus === "adopted" || voteStatus === "rejected"}>
            <button
                class="adopt"
                class:voting={voteStatus === "adopting"}
                class:disabled={votingDisabled}
                class:gray={voteStatus === "rejected" || disable}
                on:click={() => onVote(true)}>
                <div class="contents">
                    <div>
                        {$_("proposal." + (voteStatus === "adopted" ? "youVotedAdopt" : "adopt"))}
                    </div>
                    <div class="icon"><ThumbUp /></div>
                </div>
            </button>
            <button
                class="reject"
                class:voting={voteStatus === "rejecting"}
                class:disabled={votingDisabled}
                class:gray={voteStatus === "adopted" || disable}
                on:click={() => onVote(false)}>
                <div class="contents">
                    <div>
                        {$_(
                            "proposal." + (voteStatus === "rejected" ? "youVotedReject" : "reject")
                        )}
                    </div>
                    <div class="icon"><ThumbDown /></div>
                </div>
            </button>
        </div>
    </div>

    {#if isNns}
        <div class="more" class:rtl={$rtlStore}>
            <a href={dashboardProposalUrl} target="_blank">{$_("proposal.viewOnDashboard")}</a>
        </div>
    {/if}
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

<style type="text/scss">
    .header {
        display: flex;
        justify-content: space-between;
        gap: $sp3;
        margin-bottom: $sp3;

        .title-block {
            .title {
                @include font-size(fs-130);
                margin-bottom: toRem(4);
                text-decoration: underline;
                text-decoration-thickness: 1px;
                text-underline-offset: 2px;
                word-break: break-all;

                a {
                    display: flex;
                    gap: $sp2;
                    align-items: center;
                    width: fit-content;
                }
            }

            .subtitle {
                @include font-size(fs-70);
            }
            margin-bottom: $sp2;
        }

        .status {
            border-width: 2px;
            border-style: solid;
            border-radius: $sp4;
            padding: $sp2 $sp3;
            height: fit-content;

            &.positive {
                color: var(--vote-yes-color);
                border-color: var(--vote-yes-color);
            }

            &.negative {
                color: var(--vote-no-color);
                border-color: var(--vote-no-color);
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

        &.expanded {
            transition: max-height ease-in 200ms;
            max-height: toRem(360);
        }

        &.full {
            max-height: none;
            cursor: default;
        }

        .gradient {
            position: sticky;
            width: 100%;
            background: linear-gradient(transparent, var(--currentChat-msg-bg));
            height: toRem(24);
            bottom: 0;
        }

        &.expanded .gradient {
            display: none;
        }
    }

    .value {
        @include font-size(fs-120);
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
    }

    .votes {
        margin: 12px 0;

        .data {
            margin-bottom: toRem(10);
            position: relative;

            > div {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .label {
                @include font(light, normal, fs-70);
            }

            .yes {
                position: absolute;
                left: 0;
                align-items: flex-start;
                .value {
                    color: var(--vote-yes-color);
                }
            }

            .no {
                position: absolute;
                right: 0;
                align-items: flex-end;
                .value {
                    color: var(--vote-no-color);
                }
            }

            .remaining {
                margin: 0 auto;
                .value {
                    @include font-size(fs-100);
                }
            }
        }

        .progress {
            height: toRem(16);
            position: relative;
            background: var(--chatSummary-bg-selected);

            .adopt {
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                background: var(--vote-yes-color);
            }

            .reject {
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                background: var(--vote-no-color);
            }

            .vertical-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 1px;
                background-color: var(--currentChat-msg-txt);
            }

            .icon {
                position: absolute;
                top: toRem(-16);
                color: var(--currentChat-msg-txt);

                &.solid {
                    width: 1em;
                    height: 1em;
                }
            }
        }

        &.rtl {
            .votes {
                .yes {
                    left: auto;
                    right: 0;
                }
                .no {
                    left: 0;
                    right: auto;
                }
            }
            .progress {
                .adopt {
                    left: auto;
                    right: 0;
                }
                .reject {
                    right: auto;
                    left: 0;
                }
            }
        }
    }

    .vote {
        margin: $sp4 0 $sp3 0;
        display: flex;
        gap: $sp4;
        justify-content: space-between;

        @include size-below(xs) {
            flex-direction: column;
            align-items: stretch;
            gap: $sp3;
        }

        &.voted button {
            flex: auto;
        }

        button {
            @include font-size(fs-120);
            padding: toRem(12) toRem(6);
            color: white;
            cursor: pointer;
            border: 0;
            flex: 1;
            transition: background-color ease-in-out 200ms;

            .contents {
                display: flex;
                justify-content: center;
                gap: $sp3;
            }

            .icon {
                position: relative;
                color: white;
                transition: transform ease-in-out 200ms;
            }

            &.adopt {
                background-color: var(--vote-yes-color);
                .icon {
                    height: toRem(16);
                    top: toRem(1);
                    @include size-below(sm) {
                        top: 0;
                    }
                    @include size-below(xs) {
                        top: toRem(-1);
                    }
                }
            }

            &.reject {
                background-color: var(--vote-no-color);
                .icon {
                    height: toRem(16);
                    top: toRem(4);
                    @include size-below(sm) {
                        top: toRem(3);
                    }
                    @include size-below(xs) {
                        top: toRem(2);
                    }
                }
            }

            &:not(.disabled):hover {
                &.adopt {
                    background-color: var(--vote-yes-hv);
                }
                &.reject {
                    background-color: var(--vote-no-hv);
                }
                .icon {
                    transform: rotate(-8deg) scale(1.2);
                }
            }

            &.disabled {
                cursor: default;
            }

            &.gray {
                background: var(--button-disabled);
                border: 1px solid var(--button-disabled-bd);
            }

            &.voting {
                .contents {
                    visibility: hidden;
                }

                @include loading-spinner(
                    toRem(20),
                    toRem(10),
                    var(--button-spinner),
                    "../assets/plain-spinner.svg"
                );
            }
        }
    }

    .more {
        margin-top: $sp2;
        @include font-size(fs-70);
        float: left;
        &.rtl {
            float: right;
        }
    }
</style>
