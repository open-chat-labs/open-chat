<script lang="ts" module>
    export interface MenuItemProps {
        href?: string;
        disabled?: boolean;
        selected?: boolean;
        danger?: boolean;
        separator?: boolean;
        onclick?: (e?: Event) => void;
    }
</script>

<script lang="ts">
    import { ColourVars } from "component-lib";

    import type { Snippet } from "svelte";

    let {
        href,
        disabled = false,
        selected = false,
        danger = false,
        separator = false,
        icon,
        children,
        onclick,
    }: MenuItemProps & { icon?: Snippet<[string]>; children: Snippet } = $props();

    let iconColour = $derived(danger ? ColourVars.error : ColourVars.textPrimary);
</script>

{#if disabled}
    <div class:disabled class="menu-item" role="menuitem">
        {#if icon}
            <span class="icon">
                {@render icon(iconColour)}
            </span>
        {/if}
        {@render children()}
    </div>
{:else if separator}
    <hr class="menu-item-separator" />
{:else}
    <a
        {href}
        target="_blank"
        rel="noreferrer"
        tabindex="0"
        class="menu-item"
        {onclick}
        role="menuitem"
        class:selected
        class:danger>
        {#if icon}
            <span class="icon">
                {@render icon(iconColour)}
            </span>
        {/if}
        {@render children()}
    </a>
{/if}

<style lang="scss">
    :global(.menu-item) {
        display: flex;
        cursor: pointer;
        color: var(--menu-txt);
        align-items: center;
        gap: var(--sp-sm);
        height: 2.375rem;

        &:last-child {
            border-bottom: none;
        }

        &:hover,
        &.selected {
            background-color: var(--menu-hv); //TODO
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

        // TODO
        &.disabled {
            color: var(--menu-disabled-txt);
            cursor: not-allowed;
        }

        &.danger {
            color: var(--error);
        }
    }

    :global(.menu-item-separator) {
        border: 1px solid var(--menu-separator);

        &:last-child {
            display: none;
        }
    }
</style>
