<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import Translatable from "./Translatable.svelte";

    interface Props {
        items: ResourceKey[];
        selected?: any;
        underline?: boolean;
    }

    let { items, selected = $bindable(items[0]?.key), underline = false }: Props = $props();
</script>

{#if items.length > 0}
    <div class="tabs" class:underline>
        {#each items as item}
            <div
                tabindex="0"
                role="button"
                onclick={() => (selected = item.key)}
                class:selected={selected === item.key}
                class="tab">
                <Translatable resourceKey={item} />
            </div>
        {/each}
    </div>
{/if}

<style lang="scss">
    .tabs {
        display: flex;
        align-items: center;
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        gap: $sp5;

        &.underline {
            border-bottom: 1px solid var(--bd);
        }

        cursor: pointer;
        margin-bottom: $sp5;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }
</style>
