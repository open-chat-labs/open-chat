<script lang="ts">
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import {
        NnsProposalTopic,
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
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import MenuDown from "svelte-material-icons/MenuDown.svelte";
    import Launch from "svelte-material-icons/Launch.svelte";
    import { toastStore } from "../../stores/toast";
    import { rollbar } from "../../utils/logging";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { currentUserStore } from "../../stores/chat";

    export let content: ProposalContent;
    export let chatId: string;
    export let messageIndex: number;

    const api: ServiceContainer = getContext(apiKey);

    const dashboardUrl = "https://dashboard.internetcomputer.org";

    let expanded = false;
    let voting: boolean | undefined = undefined;
    let showNeuronInfo = false;

    $: myVote = content.myVote;
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
    $: votingDisabled = myVote !== undefined || voting !== undefined || votingEnded;
    $: typeLabel = $_(proposal.kind === "nns" ? "proposal.topic" : "proposal.action");
    $: typeValue =
        proposal.kind === "nns"
            ? NnsProposalTopic[proposal.topic]
            : SnsProposalAction[proposal.action];
    $: rtl = $rtlStore ? "right" : "left";
    $: user = $currentUserStore!;

    function toggleSummary() {
        expanded = !expanded;
    }

    function onVote(adopt: boolean) {
        if (votingDisabled) {
            return;
        }

        voting = adopt;

        if (process.env.ENABLE_PROPOSAL_TESTING) {
            setTimeout(() => {
                voting = undefined;
                myVote = adopt;
            }, 2000);
        } else {
            api.registerProposalVote(chatId, messageIndex, adopt)
                .then((resp) => {
                    if (resp === "success") {
                        myVote = adopt;
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
                .finally(() => (voting = undefined));
        }
    }

    function registerProposalVoteErrorMessage(
        resp: RegisterProposalVoteResponse
    ): string | undefined {
        if (resp === "already_voted") return "alreadyVoted";
        if (resp === "proposal_not_accepting_votes") return "proposalNotAceptingVotes";
        return "voteFailed";
    }

    function round2(num: number): number {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }
</script>

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
            {typeLabel}: {typeValue} | {$_("proposal.proposedBy")}:
            <a target="_blank" href={dashboardNeuronUrl}>{proposal.proposer}</a>
        </div>
    </div>
    <div class="status" class:positive class:negative>
        {ProposalDecisionStatus[proposal.status]}
    </div>
</div>

{#if proposal.summary.length > 0}
    <div class="summary" class:expanded on:click={toggleSummary}>
        <Markdown text={proposal.summary} isInline={false} />
        <div class="expand" />
    </div>
{/if}

<div class="votes" class:rtl={$rtlStore}>
    <div class="data">
        <div class="yes">
            <span class="label">{$_("yes")}</span>
            <span class="value">{adoptPercent}%</span>
        </div>
        <div class="remaining">
            {#if !votingEnded}
                <span class="label">{$_("proposal.votingPeriodRemaining")}</span>
                <span class="value">{formatTimeRemaining($now500, proposal.deadline)}</span>
            {:else}
                <span class="label">{$_("proposal.votingPeriodEnded")}</span>
                <span class="value">{toDateString(deadline)} {toShortTimeString(deadline)}</span>
            {/if}
        </div>
        <div class="no">
            <span class="label">{$_("no")}</span>
            <span class="value">{rejectPercent}%</span>
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
        <div class="icon" style="{rtl}: calc(50% - 0.625em)">
            <MenuDown size="1.25em" viewBox="-1 0 24 24" />
        </div>
    </div>
</div>

<div class="vote" class:voted={myVote !== undefined}>
    <button
        class="adopt"
        class:voting={voting === true}
        class:disabled={votingDisabled}
        class:gray={myVote === false || votingEnded}
        on:click={() => onVote(true)}>
        <div class="contents">
            <div>{$_("proposal." + (myVote === true ? "youVotedAdopt" : "adopt"))}</div>
            <div class="icon"><ThumbUp /></div>
        </div>
    </button>
    <button
        class="reject"
        class:voting={voting === false}
        class:disabled={votingDisabled}
        class:gray={myVote === true || votingEnded}
        on:click={() => onVote(false)}>
        <div class="contents">
            <div>{$_("proposal." + (myVote === false ? "youVotedReject" : "reject"))}</div>
            <div class="icon"><ThumbDown /></div>
        </div>
    </button>
</div>

<div class="more" class:rtl={$rtlStore}>
    <a href={dashboardProposalUrl} target="_blank">{$_("proposal.viewOnDashboard")}</a>
</div>

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
    :global(.summary .markdown-wrapper h2) {
        @include font(bold, normal, fs-90);
    }

    :global(.summary .markdown-wrapper p) {
        margin-bottom: $sp3;

        &:last-child {
            margin-bottom: 0;
        }
    }

    .header {
        display: flex;
        justify-content: space-between;
        gap: $sp3;
        margin-bottom: $sp3;

        .title-block {
            .title {
                @include font-size(fs-120);
                margin-bottom: 0.25em;
                text-decoration: underline;
                text-decoration-thickness: 1px;
                a {
                    display: flex;
                    gap: $sp2;
                    align-items: center;
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
                color: var(--vote-yes);
                border-color: var(--vote-yes);
            }

            &.negative {
                color: var(--vote-no);
                border-color: var(--vote-no);
            }
        }
    }

    .summary {
        transition: max-height ease-in 200ms;
        max-height: 4.5em;
        @include nice-scrollbar();
        overflow-y: auto;
        cursor: pointer;
        position: relative;

        &.expanded {
            max-height: 22.5em;
        }

        .expand {
            position: sticky;
            width: 100%;
            background: linear-gradient(transparent, var(--currentChat-msg-bg));
            height: 1.5em;
            bottom: 0;
        }

        &.expanded .expand {
            background: rgba(69, 69, 69, 0);
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
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.625em;

            > div {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .label {
                @include font(light, normal, fs-70);
            }

            .yes {
                align-items: flex-start;
                .value {
                    color: var(--vote-yes);
                }
            }

            .no {
                align-items: flex-end;
                .value {
                    color: var(--vote-no);
                }
            }

            .remaining .value {
                @include font-size(fs-100);
            }
        }

        .progress {
            height: 1em;
            position: relative;
            background: var(--chatSummary-bg-selected);

            .adopt {
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                background: var(--vote-yes);
            }

            .reject {
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                background: var(--vote-no);
            }

            .vertical-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 1px;
                background-color: var(--currentChat-msg-txt);
                filter: brightness(1.5);
            }

            .icon {
                position: absolute;
                top: -1em;
                filter: brightness(1.5);
            }
        }

        &.rtl {
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
            padding: 0.8em 0.4em;
            color: white;
            cursor: pointer;
            border: 0;
            flex: 1;

            .contents {
                display: flex;
                justify-content: center;
                gap: $sp3;
            }

            .icon {
                position: relative;
                color: white;
            }

            &.adopt {
                background-color: var(--vote-yes);
                .icon {
                    height: 1em;
                    top: 0.0625em;
                    @include size-below(sm) {
                        top: 0;
                    }
                    @include size-below(xs) {
                        top: -0.0625em;
                    }
                }
            }

            &.reject {
                background-color: var(--vote-no);
                .icon {
                    height: 1em;
                    top: 0.25em;
                    @include size-below(sm) {
                        top: 0.2em;
                    }
                    @include size-below(xs) {
                        top: 0.1em;
                    }
                }
            }

            &:hover {
                filter: brightness(0.7);
            }

            &.disabled {
                cursor: default;
                filter: none;
            }

            &.gray {
                background-color: gray;
            }

            &.voting {
                .contents {
                    visibility: hidden;
                }

                @include loading-spinner(
                    1.2em,
                    0.6em,
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
