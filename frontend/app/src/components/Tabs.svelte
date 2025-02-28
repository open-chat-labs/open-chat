<script module>
    export type Tab = {
        title: ResourceKey;
        snippet: Snippet;
    };
</script>

<script lang="ts">
    import type { Snippet } from "svelte";
    import Translatable from "./Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    interface Props {
        tabs: Tab[];
        initialIndex?: number;
        nested?: boolean;
    }

    let { tabs, initialIndex = 0, nested = false }: Props = $props();
    let selectedIndex = $state(initialIndex);
</script>

<div class="tabs" class:nested>
    {#each tabs as tab, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            tabindex="0"
            role="button"
            class="tab"
            class:nested
            onclick={() => (selectedIndex = i)}
            class:selected={selectedIndex === i}>
            <Translatable resourceKey={tab.title}></Translatable>
        </div>
    {/each}
</div>
{#if selectedIndex !== undefined}
    {@render tabs[selectedIndex]?.snippet()}
{/if}

<style lang="scss">
    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin-bottom: $sp4;

        @include mobile() {
            gap: $sp4;
        }

        &.nested {
            @include font(medium, normal, fs-80);
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);

                &.nested {
                    border-bottom-color: var(--accent);
                }
            }
        }
    }
</style>
