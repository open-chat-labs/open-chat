<script lang="ts">
    export let href: string | undefined = undefined;
    export let disabled: boolean = false;
    export let selected: boolean = false;
    export let warning: boolean = false;
    export let separator: boolean = false;
    export let unpadded: boolean = false;
</script>

{#if disabled}
    <div class:unpadded class:disabled class="menu-item" role="menuitem">
        <span class="icon">
            <slot name="icon" />
        </span>
        <slot name="text" />
    </div>
{:else if separator}
    <hr class="separator" />
{:else}
    <a
        {href}
        target="_blank"
        rel="noreferrer"
        class:unpadded
        tabindex="0"
        class="menu-item"
        on:click
        role="menuitem"
        class:selected
        class:warning>
        <span class="icon">
            <slot name="icon" />
        </span>
        <slot name="text" />
    </a>
{/if}

<style lang="scss">
    .menu-item {
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

    .separator {
        border: 1px solid var(--menu-separator);

        &:last-child {
            display: none;
        }
    }
</style>
