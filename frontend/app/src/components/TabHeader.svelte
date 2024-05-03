<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import Translatable from "./Translatable.svelte";

    export let items: ResourceKey[];
    export let selected = 0;
    export let underline = false;
</script>

{#if items.length > 0}
    <div class="tabs" class:underline>
        {#each items as item, i}
            <div
                tabindex="0"
                role="button"
                on:click={() => (selected = i)}
                class:selected={selected === i}
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
