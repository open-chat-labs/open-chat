<script context="module" lang="ts">
    export type Option = {
        id: string;
        label: string;
    };
</script>

<script lang="ts">
    import { _ } from "svelte-i18n";

    export let options: Option[];
    export let selected: string;

    function selectOption(id: string) {
        selected = id;
    }
</script>

<div class="toggle-wrapper" role="radiogroup">
    {#each options as { id, label }, i}
        <div
            role="radio"
            tabindex={i}
            class="toggle"
            class:selected={id === selected}
            class:first={i === 0}
            class:last={i === options.length - 1}
            on:click={() => selectOption(id)}>
            {label}
        </div>
    {/each}
</div>

<style lang="scss">
    .toggle-wrapper {
        display: flex;
        align-items: center;
        border: 1px solid var(--bd);
        border-radius: 4px;
        cursor: pointer;

        .toggle {
            border: none;
            border-right: 1px solid var(--bd);
            padding: 6px 10px 5px 9px;

            &:hover,
            &.selected {
                color: var(--button-txt);
                background: var(--button-bg);
            }

            &.first {
                border-radius: 4px 0 0 4px;
            }

            &.last {
                border-right: none;
                border-radius: 0 4px 4px 0;
            }
        }
    }
</style>
