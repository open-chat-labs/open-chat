<script lang="ts">
    import { onDestroy } from "svelte";
    import { tooltipStore } from "../stores/tooltip";
    import { tick } from "svelte";
    import Hoverable from "./Hoverable.svelte";
    import type { Alignment, Position } from "../utils/alignment";

    export let enable = true;
    export let position: Position = "top";
    export let align: Alignment = "start";
    export let fill = false;
    export let gutter = 8;

    let target: Hoverable;
    let tooltipContainer: HTMLElement;
    let hovering: boolean;
    let longPressed: boolean;

    $: show = enable && (hovering || longPressed);

    $: {
        if (show) {
            showTooltip();
        } else {
            closeTooltip();
        }
    }

    onDestroy(closeTooltip);

    async function showTooltip(): Promise<void> {
        const rect = target.getBoundingClientRect();
        tooltipStore.show(tooltipContainer);

        await tick();

        tooltipStore.position(rect, position, align, gutter);
    }

    function closeTooltip() {
        tooltipStore.hide();
    }
</script>

<Hoverable {fill} bind:this={target} bind:hovering bind:longPressed enableLongPress>
    <slot name="target" />
</Hoverable>

<div class="tooltip-blueprint">
    <span class="tooltip" bind:this={tooltipContainer}>
        {#if $tooltipStore === tooltipContainer}
            <slot {align} {position} name="tooltip" />
        {/if}
    </span>
</div>

<style lang="scss">
    .tooltip {
        position: absolute;
    }

    .tooltip-blueprint {
        display: none;
    }
</style>
