<script lang="ts">
    import { tabsKey } from "./TabControl.svelte";
    import type { TabControlData } from "./TabControl.svelte";
    import { getContext } from "svelte";

    export let id: number;
    export let isTitle: boolean;
    export let isContent: boolean;

    const { selectedTab, tabs } = getContext<TabControlData>(tabsKey);
    $tabs = $tabs.some((t) => t == id) ? $tabs : [...$tabs, id];

    $: isSelected = id == $selectedTab;
</script>

{#if isTitle}
    <div class="tab" class:selected={isSelected} on:click={() => ($selectedTab = id)}>
        <slot name="title" />
    </div>
{/if}

{#if isContent && isSelected}
    <slot />
{/if}

<style lang="scss">
    .tab {
        cursor: pointer;
        padding: $sp3 $sp4;
        min-width: 100px;
        border: 1px solid var(--button-bg);
        text-align: center;
        border-bottom: none;
        border-radius: 6px 6px 0 0;
        &.selected {
            background-color: var(--button-bg);
            color: var(--button-txt);
        }
    }
</style>
