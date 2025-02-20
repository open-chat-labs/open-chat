<script lang="ts">
    import type { Snippet } from "svelte";
    import type { MenuItemProps } from "./MenuItemLegacy.svelte";

    let {
        href,
        disabled = false,
        selected = false,
        warning = false,
        separator = false,
        unpadded = false,
        icon,
        text,
        onclick,
    }: MenuItemProps & { icon?: Snippet; text?: Snippet } = $props();
</script>

{#if disabled}
    <div class:unpadded class:disabled class="menu-item" role="menuitem">
        <span class="icon">
            {@render icon?.()}
        </span>
        {@render text?.()}
    </div>
{:else if separator}
    <hr class="menu-item-separator" />
{:else}
    <a
        {href}
        target="_blank"
        rel="noreferrer"
        class:unpadded
        tabindex="0"
        class="menu-item"
        {onclick}
        role="menuitem"
        class:selected
        class:warning>
        <span class="icon">
            {@render icon?.()}
        </span>
        {@render text?.()}
    </a>
{/if}

<style lang="scss">
    :global(.menu-item) {
        display: flex;
        cursor: pointer;
        color: var(--menu-txt);
        align-items: center;
        @include font-size(fs-90);
        padding: 10px;
        gap: 10px;

        &.unpadded {
            padding: 0;
        }

        &:last-child {
            border-bottom: none;
        }

        &:hover,
        &.selected {
            background-color: var(--menu-hv);
        }

        .icon {
            flex: 0 0 24px;
        }

        .icon:not(:empty) {
            display: flex;
        }

        .icon:empty {
            display: none;
        }

        &.disabled {
            color: var(--menu-disabled-txt);
            cursor: not-allowed;
        }

        &.warning {
            color: var(--menu-warn);
        }
    }

    :global(.menu-item-separator) {
        border: 1px solid var(--menu-separator);

        &:last-child {
            display: none;
        }
    }
</style>
