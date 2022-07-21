<script lang="ts">
    import { ProposalContent, ProposalDecisionStatus } from "../../domain/chat/chat";
    import Markdown from "./Markdown.svelte";
    import { now, now500 } from "../../stores/time";
    import { formatTimeRemaining } from "../../utils/time";
    import { toDateString, toShortTimeString } from "../../utils/date";
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";

    export let content: ProposalContent;

    let expanded = false;
    let voting = false;
    let myVote: boolean | undefined = undefined;

    $: proposal = content.proposal;
    $: positive =
        proposal.status == ProposalDecisionStatus.Adopted ||
        proposal.status == ProposalDecisionStatus.Executed;
    $: negative =
        proposal.status == ProposalDecisionStatus.Failed ||
        proposal.status == ProposalDecisionStatus.Rejected ||
        proposal.status == ProposalDecisionStatus.Unspecified;
    $: neutral = proposal.status == ProposalDecisionStatus.Open;
    $: dashboardUrl = `https://dashboard.internetcomputer.org/proposal/${proposal.id}`;
    $: adoptPercent = 20;
    $: rejectPercent = 10;
    $: deadline = new Date(Number(proposal.deadline));
    $: votingEnded = proposal.deadline <= $now;

    function toggleSummary() {
        expanded = !expanded;
    }

    function onVote(adopt: boolean) {
        if (myVote !== undefined) {
            return;
        }

        voting = true;
        myVote = adopt;
        setTimeout(() => {
            voting = false;
        }, 2000);
    }

    // TODO
    // 1. left/right
    // 2. define colors
    // 3. translate text
    // 4. Expand/contract transition
    // 5. Expand/contract icon
    // 6. Expand/contract faded overlay on bottom of summary
    // 7. Vertical lines on progress bar
    // 8. Chevrons on progress bar
    // 9. Popup with more details
    // * 10. If voted - grey out other button and disable both
    // 11. Check this component scales down ok
    // 11.1 Limit to 4 decimal places on yes/no percent
    // 12. Wire up votes properly
    // 13. Wire up voting properly
    // 14. Wire up my vote properly
</script>

<div class="header">
    <span class="title">{proposal.title}</span>
    <span class="status" class:positive class:negative class:neutral
        >{ProposalDecisionStatus[proposal.status]}</span>
</div>

{#if proposal.summary.length > 0}
    <div class="summary" class:expanded on:click={toggleSummary}>
        <Markdown text={proposal.summary} isInline={false} />
    </div>
{/if}

<div class="votes">
    <div class="data">
        <div class="yes">
            <span class="label">Yes</span>
            <span class="value">{adoptPercent}%</span>
        </div>
        <div class="remaining">
            {#if !votingEnded}
                <span class="label">Voting period remaining</span>
                <span class="value">{formatTimeRemaining($now500, proposal.deadline)}</span>
            {:else}
                <span class="label">Voting period ended</span>
                <span class="value">{toDateString(deadline)} {toShortTimeString(deadline)}</span>
            {/if}
        </div>
        <div class="no">
            <span class="label">No</span>
            <span class="value">{rejectPercent}%</span>
        </div>
    </div>
    <div class="progress">
        <div class="adopt" style="width: {adoptPercent}%" />
        <div class="reject" style="width: {rejectPercent}%" />
    </div>
</div>

{#if !votingEnded}
    <div class="vote">
        <button
            class="adopt"
            class:voting={voting && myVote === true}
            class:disabled={myVote !== undefined}
            class:gray={myVote === false}
            on:click={() => onVote(true)}>
            <div>
                <div>Adopt</div>
                <div class="icon-wrapper"><div class="icon"><ThumbUp color="#fff" /></div></div>
            </div>
        </button>
        <button
            class="reject"
            class:voting={voting && myVote === false}
            class:disabled={myVote !== undefined}
            class:gray={myVote === true}
            on:click={() => onVote(false)}>
            <div>
                <div>Reject</div>
                <div class="icon-wrapper"><div class="icon"><ThumbDown color="#fff" /></div></div>
            </div>
        </button>
    </div>
{/if}

<div class="more">
    {#if proposal.url.length > 0}
        <a href={proposal.url} target="_blank">additional content</a>&nbsp;|&nbsp;{/if}<a
        href={dashboardUrl}
        target="_blank">view on dashboard</a>
</div>

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
        align-items: baseline;
        margin-bottom: $sp3;

        .title {
            @include font(bold, normal, fs-120);
        }

        .status {
            display: inline-block;
            border-width: 2px;
            border-style: solid;
            border-radius: $sp4;
            padding: $sp2 $sp3;

            &.positive {
                // color: lightgreen;
                // border-color: lightgreen;
                color: #22a7f2;
                border-color: #22a7f2;
            }

            &.negative {
                // color: red;
                // border-color: red;
                color: var(--accent);
                border-color: var(--accent);
            }

            &.neutral {
                // color: orange;
                // border-color: orange;
            }
        }
    }

    .summary {
        max-height: 4.5em;
        overflow: hidden;
        cursor: pointer;

        &.expanded {
            max-height: none;
            overflow: none;
        }
    }

    .votes {
        margin: 12px 0;

        .data {
            display: flex;
            justify-content: space-between;
            margin-bottom: $sp2;

            > div {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .label {
                @include font(light, normal, fs-70);
            }

            .value {
                @include font-size(fs-120);
                font-feature-settings: "tnum";
                font-variant-numeric: tabular-nums;
            }

            .yes {
                align-items: flex-start;
                .value {
                    color: #22a7f2;
                }
            }

            .no {
                align-items: flex-end;
                .value {
                    color: var(--accent);
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
                background: #22a7f2;
            }

            .reject {
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                background: var(--accent);
            }
        }
    }

    .vote {
        margin: $sp4 0 $sp3 0;
        display: flex;
        gap: $sp4;
        align-items: center;
        justify-content: space-between;

        button {
            @include font-size(fs-120);
            padding: 0.8em;
            color: white;
            cursor: pointer;
            border: 0;
            flex: auto;

            > div {
                display: flex;
                justify-content: center;
                gap: $sp3;
            }

            .icon {
                position: relative;
            }

            &.adopt {
                background-color: #22a7f2;
                .icon {
                    top: 1px;
                }
            }

            &.reject {
                background-color: var(--accent);
                .icon {
                    top: 4px;
                }
            }

            &:hover {
                filter: brightness(0.7);
            }

            &.disabled:hover {
                filter: brightness(1);
            }

            &.disabled {
                cursor: default;
            }

            &.gray {
                background-color: gray;
            }

            &.voting {
                .icon-wrapper {
                    .icon {
                        visibility: hidden;
                    }
                    @include loading-spinner(1.2em, 0.6em, false, var(--button-spinner));
                }
            }
        }
    }

    .more {
        margin-top: $sp2;
        @include font-size(fs-70);
        float: left;
    }
</style>
