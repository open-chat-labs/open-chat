<script lang="ts">
    export let cls = "";
    export let loading: boolean = false;
    export let disabled: boolean = false;
    export let secondary: boolean = false;
    export let small: boolean = false;
    export let tiny: boolean = false;
    export let fill: boolean = false;
</script>

<button
    on:click
    class={cls}
    class:loading
    class:disabled
    class:small
    class:tiny
    {disabled}
    class:secondary
    class:fill>
    {#if !loading}
        <slot />
    {/if}
</button>

<style type="text/scss">
    button {
        transition: background ease-in-out 200ms;
        background: var(--button-bg);
        color: var(--button-txt);
        padding: $sp3 $sp6;
        cursor: pointer;
        border: 1px solid var(--button-bd);
        min-height: 45px;
        min-width: 150px;
        @include font(book, normal, fs-100);

        &.small {
            padding: $sp2 $sp5;
            height: 25px;
            min-width: 100px;
        }

        &.tiny {
            padding: $sp2 $sp5;
            min-height: $sp6;
            min-width: 100px;
        }

        &:hover {
            background: var(--button-hv);
        }

        &.loading {
            @include loading-spinner(1em, 0.5em, false, var(--button-spinner));
        }

        &.disabled {
            background: var(--button-disabled);
            color: var(--button-disabled-txt);
            cursor: not-allowed;
            border: 1px solid var(--button-disabled-bd);
        }

        &.secondary {
            background: var(--button-txt);
            color: var(--button-bg);
            border: 1px solid var(--button-bg);
        }

        &.fill {
            width: 100%;
            height: 100%;
        }
    }
</style>
