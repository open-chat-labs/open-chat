<script lang="ts">
    import { CommonButton, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        selectedTab?: "community" | "channel";
        header: Snippet;
        communityTab: Snippet;
        channelTab: Snippet;
    }

    let { selectedTab = $bindable("channel"), header, communityTab, channelTab }: Props = $props();

    function selectTab(tab: "community" | "channel") {
        selectedTab = tab;
    }
</script>

{@render header()}

<Container
    parentDirection={"vertical"}
    mainAxisAlignment={"spaceBetween"}
    padding={["zero", "md", "lg", "md"]}
    gap={"sm"}>
    <CommonButton
        width={selectedTab === "channel"
            ? { kind: "share", value: 1.3 }
            : { kind: "share", value: 1 }}
        onClick={() => selectTab("channel")}
        mode={selectedTab === "channel" ? "active" : "default"}
        size={"small"}>
        <Translatable resourceKey={i18nKey("level.channel")}></Translatable>
    </CommonButton>
    <CommonButton
        width={selectedTab === "community"
            ? { kind: "share", value: 1.3 }
            : { kind: "share", value: 1 }}
        onClick={() => selectTab("community")}
        mode={selectedTab === "community" ? "active" : "default"}
        size={"small"}>
        <Translatable resourceKey={i18nKey("level.community")}></Translatable>
    </CommonButton>
</Container>

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
                background: var(--button-bg);
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
        flex: auto;
        @include nice-scrollbar();
    }
</style>
