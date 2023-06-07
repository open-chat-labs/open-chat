<script context="module" lang="ts">
    export const tabsKey = Symbol();
    export type TabControlData = {
        tabs: Writable<number[]>;
        selectedTab: Writable<number>;
    };
</script>

<script lang="ts">
    import { setContext, onMount } from "svelte";
    import { writable } from "svelte/store";
    import type { Writable } from "svelte/store";

    const tabs = writable<number[]>([]);
    const selectedTab = writable<number>(0);

    setContext<TabControlData>(tabsKey, {
        tabs,
        selectedTab,
    });

    onMount(() => {
        if ($tabs.length > 0) $selectedTab = $tabs[0];
    });
</script>

<div class="tab-control">
    <div class="tab">
        <slot isTitle={true} isContent={false} />
    </div>
    <div class="tab-page">
        <slot isTitle={false} isContent={true} />
    </div>
</div>

<style lang="scss">
    .tab {
        display: flex;
        border-bottom: 1px solid var(--button-bg);
        margin-bottom: $sp4;
    }
</style>
