<script lang="ts">
    import { rtlStore } from "../../../stores/rtl";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";

    export let adoptPercent: number;
    export let rejectPercent: number;

    $: rtl = $rtlStore ? "right" : "left";
</script>

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

<style type="text/scss">
    .progress {
        height: toRem(16);
        position: relative;
        background: var(--chatSummary-bg-selected);
        flex: auto;
        border-radius: $sp3;

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

        .icon {
            position: absolute;
            top: toRem(-16);
            color: var(--txt);

            &.solid {
                width: 1em;
                height: 1em;
            }
        }
    }
</style>
