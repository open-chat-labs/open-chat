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
    import { Body, ColourVars } from "component-lib";

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
    }: MenuItemProps & { icon?: Snippet<[string, string]>; children?: Snippet } = $props();

    let iconColour = $derived(danger ? ColourVars.error : ColourVars.textPrimary);
    let iconSize = "20px";
</script>

{#if disabled}
    <div class:disabled class="menu_item" role="menuitem">
        {#if icon}
            <span class="icon">
                {@render icon(iconColour, iconSize)}
            </span>
        {/if}
        <Body width={{ kind: "hug" }}>
            {@render children?.()}
        </Body>
    </div>
{:else if separator}
    <hr class="menu_item_separator" />
{:else}
    <a
        {href}
        target="_blank"
        rel="noreferrer"
        tabindex="0"
        class="menu_item"
        {onclick}
        role="menuitem"
        class:selected
        class:danger>
        {#if icon}
            <span class="icon">
                {@render icon(iconColour, iconSize)}
            </span>
        {/if}
        <Body colour={danger ? "error" : "textPrimary"} width={{ kind: "hug" }}>
            {@render children?.()}
        </Body>
    </a>
{/if}

<style lang="scss">
    :global(.menu_item) {
        display: flex;
        cursor: pointer;
        color: var(--text-primary);
        align-items: center;
        gap: var(--sp-sm);
        height: 2.375rem;
        padding: 0 var(--sp-lg);
        width: 100%;

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

    :global(.menu_item_separator) {
        border: var(--bw-thin) solid var(--background-2);
        width: 100%;

        &:last-child {
            display: none;
        }
    }
</style>
