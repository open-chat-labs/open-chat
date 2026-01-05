<script module>
    export type Tab = {
        title: ResourceKey;
        snippet: Snippet;
    };
</script>

<script lang="ts">
    import { Body, BodySmall, Row, transition } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        tabs: Tab[];
        initialIndex?: number;
        nested?: boolean;
        selectedIndex?: number;
        onTabSelected?: (index: number) => void;
    }

    let {
        tabs,
        initialIndex = 0,
        nested = false,
        selectedIndex = $bindable(initialIndex),
        onTabSelected,
    }: Props = $props();

    function selectTab(idx: number) {
        transition(["fade"], () => {
            selectedIndex = idx;
            onTabSelected?.(idx);
        });
    }
</script>

<Row overflow={"visible"} gap={"md"} crossAxisAlignment={"center"}>
    {#each tabs as tab, i}
        {@const selected = selectedIndex === i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            tabindex="0"
            role="button"
            class="tab"
            class:nested
            onclick={() => selectTab(i)}
            class:selected>
            {#if nested}
                <BodySmall colour={selected ? "textPrimary" : "textSecondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={tab.title}></Translatable>
                </BodySmall>
            {:else}
                <Body colour={selected ? "textPrimary" : "textSecondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={tab.title}></Translatable>
                </Body>
            {/if}
        </div>
    {/each}
</Row>
{#if selectedIndex !== undefined}
    {@render tabs[selectedIndex]?.snippet()}
{/if}

<style lang="scss">
    .tab {
        padding-bottom: toRem(8);
        margin-bottom: -2px;
        border-bottom: var(--bw-thick) solid transparent;
        white-space: nowrap;
        &.selected {
            border-bottom: var(--bw-thick) solid var(--text-primary);

            &.nested {
                border-bottom-color: var(--primary);
            }
        }
    }
</style>
