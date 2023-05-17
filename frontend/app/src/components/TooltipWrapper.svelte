<script lang="ts">
    import { onDestroy } from "svelte";
    import { tooltipStore } from "../stores/tooltip";
    import { tick } from "svelte";
    import Hoverable from "./Hoverable.svelte";

    export let enable = true;
    export let position: "top" | "right" | "bottom" | "left" = "top";
    export let align: "start" | "center" | "end" = "start";

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

        tooltipStore.position(rect, position, align);
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
            <slot {align} {position} name="tooltip" />
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
