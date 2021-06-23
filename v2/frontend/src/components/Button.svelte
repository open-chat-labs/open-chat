<script lang="ts">
    export let cls = "";
    export let loading: boolean = false;
    export let disabled: boolean = false;
    export let secondary: boolean = false;
</script>

<button
    on:click
    class={cls}
    class:loading
    class:disabled
    {disabled}
    class:secondary>
    {#if !loading}
        <slot />
    {/if}
</button>

<style type="text/scss">
    @import "../styles/mixins";
    button {
        transition: background ease-in-out 200ms;
        background: var(--button-bg);
        color: var(--button-txt);
        padding: 10px 30px;
        cursor: pointer;
        border: 1px solid var(--button-bd);
        min-height: 45px;
        min-width: 150px;

        &:hover {
            background: var(--button-hv);
        }

        &.loading {
            @include loading-spinner(1em, 0.5em, false, var(--button-spinner));
        }

        &.disabled {
            background: var(--button-disabled);
        }

        // todo this needs theming
        &.secondary {
            background: transparent;
            color: #cccccc;
            border: 1px solid #cccccc;
        }
    }
</style>
