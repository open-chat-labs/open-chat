<script lang="ts">
    import { rtlStore } from "../../../stores/rtl";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import { now500 } from "../../../stores/time";

    export let adoptPercent: number;
    export let rejectPercent: number;
    export let votingEnded: boolean;
    export let deadline: number;

    const client = getContext<OpenChat>("client");

    $: deadlineDate = new Date(Number(deadline));
    $: rtl = $rtlStore ? "right" : "left";
</script>

<div class="wrapper">
    <div class="icon" style="{rtl}: calc(3% - 0.5em)">
        <ChevronDown viewBox="-1 0 24 24" />
    </div>
    <div class="icon solid" style="{rtl}: calc(50% - 0.5em)">
        <svg viewBox="-1 0 24 24">
            <path d="M6,10 L12,16 L18,10 H7Z" fill="currentColor" />
        </svg>
    </div>
    <div class="progress">
        <div class="adopt" style="width: {adoptPercent}%" />
        <div class="reject" style="width: {rejectPercent}%" />
        <div class="vertical-line" style="{rtl}: 3%" />
        <div class="vertical-line" style="{rtl}: 50%" />
    </div>

    <div class="remaining">
        {#if !votingEnded}
            <span class="label">{$_("proposal.votingPeriodRemaining")}</span>
            <span class="value">{client.formatTimeRemaining($now500, deadline)}</span>
        {:else}
            <span class="label">{$_("proposal.votingPeriodEnded")}</span>
            <span class="value"
                >{client.toDateString(deadlineDate)}
                {client.toShortTimeString(deadlineDate)}</span>
        {/if}
    </div>
</div>

<style type="text/scss">
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
