<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import Translatable from "../../Translatable.svelte";

    export let channelText: ResourceKey;
    export let communityText: ResourceKey;
    export let selectedTab: "community" | "channel" = "channel";

    function selectTab(tab: "community" | "channel") {
        selectedTab = tab;
    }
</script>

<slot name="header" />

<div class="button-tabs">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class:selected={selectedTab === "channel"}
        on:click={() => selectTab("channel")}
        class="button-tab">
        <Translatable resourceKey={channelText} />
    </div>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class:selected={selectedTab === "community"}
        on:click={() => selectTab("community")}
        class="button-tab">
        <Translatable resourceKey={communityText} />
    </div>
</div>

{#if selectedTab === "community"}
    <slot name="community" />
{:else if selectedTab === "channel"}
    <slot name="channel" />
{/if}

<style lang="scss">
    .button-tabs {
        margin-bottom: $sp4;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: var(--bw) solid var(--bd);
        border-bottom: var(--bw) solid var(--bd);

        .button-tab {
            display: flex;
            justify-content: center;
            align-items: center;
            flex: 1;
            height: toRem(50);
            cursor: pointer;
            transition:
                background ease-in-out 200ms,
                color ease-in-out 200ms;

            &.selected {
                background-color: var(--button-bg);
                @media (hover: hover) {
                    &:hover {
                        background: var(--button-hv);
                        color: var(--button-hv-txt);
                    }
                }
            }
        }
    }
</style>
