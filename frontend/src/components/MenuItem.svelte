<script lang="ts">
    export let disabled: boolean = false;
    export let selected: boolean = false;
</script>

{#if disabled}
    <div class:disabled class="menu-item" role="menuitem">
        <span class="icon">
            <slot name="icon" />
        </span>
        <slot name="text" />
    </div>
{:else}
    <div class="menu-item" on:click role="menuitem" class:selected>
        <span class="icon">
            <slot name="icon" />
        </span>
        <slot name="text" />
    </div>
{/if}

<style type="text/scss">
    .menu-item {
        display: flex;
        cursor: pointer;
        border-bottom: 1px solid var(--menu-bd);
        color: var(--menu-txt);
        align-items: center;
        @include font-size(fs-90);
        padding: 10px;

        @include mobile() {
            @include font-size(fs-80);
            padding: 9px;
        }

        &:last-child {
            border-bottom: none;
        }

        &:hover,
        &.selected {
            background-color: var(--menu-hv);
        }

        .icon {
            display: flex;
            flex: 0 0 2.125rem;
        }

        &.disabled {
            color: var(--menu-disabled-txt);
            cursor: not-allowed;
        }
    }
</style>
