<script lang="ts">
    import { onDestroy } from "svelte";
    import { tooltipStore } from "../stores/tooltip";
    import { tick } from "svelte";
    import Hoverable from "./Hoverable.svelte";

    export let enable = true;
    export let centreChevron = false;
    export let alignRight: boolean;
    export let bottomOffset = 0;

    let target: HTMLElement;
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

        tooltipStore.position(rect, alignRight, bottomOffset, centreChevron);
    }

    function closeTooltip() {
        tooltipStore.hide();
    }
</script>

<div bind:this={target}>
    <Hoverable bind:hovering bind:longPressed enableLongPress={true}>
        <slot name="target" />
    </Hoverable>
</div>

<div class="tooltip-blueprint">
    <span class="tooltip" bind:this={tooltipContainer}>
        {#if $tooltipStore === tooltipContainer}
            <slot name="tooltip" />
        {/if}
    </span>
</div>

<style type="text/scss">
    .tooltip {
        position: absolute;
    }

    .tooltip-blueprint {
        display: none;
    }
</style>
