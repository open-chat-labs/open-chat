<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    export let selectedTab: "community" | "channel" = "channel";
    export let flush = false;

    function selectTab(tab: "community" | "channel") {
        selectedTab = tab;
    }
</script>

<slot name="header" />

<div class="button-tabs" class:flush>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class:selected={selectedTab === "channel"}
        on:click={() => selectTab("channel")}
        class="button-tab">
        <Translatable resourceKey={i18nKey("level.channel")} />
    </div>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class:selected={selectedTab === "community"}
        on:click={() => selectTab("community")}
        class="button-tab">
        <Translatable resourceKey={i18nKey("level.community")} />
    </div>
</div>

<div class="body">
    {#if selectedTab === "community"}
        <slot name="community" />
    {:else if selectedTab === "channel"}
        <slot name="channel" />
    {/if}
</div>

<style lang="scss">
    .button-tabs {
        margin-bottom: $sp4;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: var(--bw) solid var(--bd);
        border-bottom: var(--bw) solid var(--bd);

        &.flush {
            margin-bottom: 0;
        }

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

    .body {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        flex: auto;
        @include nice-scrollbar();
    }
</style>
