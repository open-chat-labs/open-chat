<script lang="ts">
    export let disabled: boolean = false;
</script>

{#if disabled}
    <div class:disabled class="menu-item" role="menuitem">
        <span class="icon">
            <slot name="icon" />
        </span>
        <slot name="text" />
    </div>
{:else}
    <div class="menu-item" on:click role="menuitem">
        <span class="icon">
            <slot name="icon" />
        </span>
        <slot name="text" />
    </div>
{/if}

<style type="text/scss">
    .menu-item {
        display: flex;
        padding: $sp3;
        cursor: pointer;
        border-bottom: 1px solid var(--menu-bd);
        color: var(--menu-txt);
        @include font(book, normal, fs-90);

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background-color: var(--menu-hv);
        }

        .icon {
            flex: 0 0 34px;
        }

        &.disabled {
            color: var(--menu-disabled-txt);
            cursor: not-allowed;
        }
    }
</style>
