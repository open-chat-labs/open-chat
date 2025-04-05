<script lang="ts">
    import { rtlStore } from "../../../stores/rtl";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { now500 } from "../../../stores/time";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    interface Props {
        adoptPercent: number;
        rejectPercent: number;
        votingEnded: boolean;
        deadline: number;
        minYesPercentageOfTotal: number;
        minYesPercentageOfExercised: number;
    }

    let {
        adoptPercent,
        rejectPercent,
        votingEnded,
        deadline,
        minYesPercentageOfTotal,
        minYesPercentageOfExercised,
    }: Props = $props();

    const client = getContext<OpenChat>("client");

    let deadlineDate = $derived(new Date(Number(deadline)));
    let rtl = $derived($rtlStore ? "right" : "left");
</script>

<div class="wrapper">
    <div class="icon" style="{rtl}: calc({minYesPercentageOfTotal}% - 0.5em)">
        <ChevronDown viewBox="-1 0 24 24" />
    </div>
    <div class="icon solid" style="{rtl}: calc({minYesPercentageOfExercised}% - 0.5em)">
        <svg viewBox="-1 0 24 24">
            <path d="M6,10 L12,16 L18,10 H7Z" fill="currentColor" />
        </svg>
    </div>
    <div class="progress">
        <div class="adopt" style="width: {adoptPercent}%"></div>
        <div class="reject" style="width: {rejectPercent}%"></div>
        <div class="vertical-line" style="{rtl}: {minYesPercentageOfTotal}%"></div>
        <div class="vertical-line" style="{rtl}: {minYesPercentageOfExercised}%"></div>
    </div>

    <div class="remaining">
        {#if !votingEnded}
            <span class="label"
                ><Translatable resourceKey={i18nKey("proposal.votingPeriodRemaining")} /></span>
            <span class="value">{client.formatTimeRemaining($now500, deadline)}</span>
        {:else}
            <span class="label"
                ><Translatable resourceKey={i18nKey("proposal.votingPeriodEnded")} /></span>
            <span class="value"
                >{client.toDateString(deadlineDate)}
                {client.toShortTimeString(deadlineDate)}</span>
        {/if}
    </div>
</div>

<style lang="scss">
    .wrapper {
        flex: auto;
        position: relative;
    }

    .icon {
        position: absolute;
        top: toRem(-16);
        color: var(--txt);

        &.solid {
            width: 1em;
            height: 1em;
        }
    }

    .progress {
        height: toRem(16);
        position: relative;
        background: var(--chatSummary-bg-selected);
        border-radius: $sp3;
        margin-top: 24px;
        overflow: hidden;
        @include mobile() {
            margin-top: 0;
        }

        .adopt {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            background: var(--vote-yes-color);
            border-radius: $sp3 0 0 $sp3;
        }

        .reject {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            background: var(--vote-no-color);
            border-radius: 0 $sp3 $sp3 0;
        }

        .vertical-line {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 1px;
            background-color: var(--txt);
        }
    }
    .remaining {
        margin: 0 auto;
        margin-top: 10px;
        text-align: center;
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        .label {
            font-weight: 700;
        }
        @include mobile() {
            margin-top: $sp4;
        }
    }
</style>
