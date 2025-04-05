<script lang="ts">
    import type { Snippet } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        selectedTab?: "community" | "channel";
        flush?: boolean;
        header: Snippet;
        communityTab: Snippet;
        channelTab: Snippet;
    }

    let {
        selectedTab = $bindable("channel"),
        flush = false,
        header,
        communityTab,
        channelTab,
    }: Props = $props();

    function selectTab(tab: "community" | "channel") {
        selectedTab = tab;
    }
</script>

{@render header()}

<div class="button-tabs" class:flush>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class:selected={selectedTab === "channel"}
        onclick={() => selectTab("channel")}
        class="button-tab">
        <Translatable resourceKey={i18nKey("level.channel")} />
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class:selected={selectedTab === "community"}
        onclick={() => selectTab("community")}
        class="button-tab">
        <Translatable resourceKey={i18nKey("level.community")} />
    </div>
</div>

<div class="body">
    {#if selectedTab === "community"}
        {@render communityTab()}
    {:else if selectedTab === "channel"}
        {@render channelTab()}
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
                color: var(--button-txt);
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
