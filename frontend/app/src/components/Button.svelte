<script lang="ts">
    export let cls = "";
    export let loading: boolean = false;
    export let disabled: boolean = false;
    export let secondary: boolean = false;
    export let small: boolean = false;
    export let tiny: boolean = false;
    export let fill: boolean = false;
    export let hollow: boolean = false;
    export let title: string | undefined = undefined;
    export let square: boolean = false;
</script>

<button
    on:click|stopPropagation
    class={cls}
    class:loading
    class:disabled
    class:small
    class:tiny
    class:hollow
    {disabled}
    class:secondary
    class:square
    {title}
    class:fill>
    {#if !loading}
        <slot />
    {/if}
</button>

<style lang="scss">
    button {
        transition: background ease-in-out 200ms;
        background: var(--button-bg);
        color: var(--button-txt);
        padding: $sp3 $sp6;
        border-radius: $sp2;
        cursor: pointer;
        border: none;
        min-height: 45px;
        min-width: 150px;
        position: relative;
        @include font(book, normal, fs-100, 20);

        &.square {
            border-radius: 0;
        }

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
            @include loading-spinner(
                1em,
                0.5em,
                var(--button-spinner),
                "/assets/plain-spinner.svg"
            );
        }

        &.hollow {
            background-color: transparent;
            color: var(--txt);
            border: 1px solid var(--bd);
        }

        &.disabled {
            background: var(--button-disabled);
            color: var(--button-disabled-txt);
            cursor: not-allowed;
        }

        &.secondary {
            background: none;
            color: var(--txt-light);
            border: 1px solid var(--bd);
        }

        &.fill {
            width: 100%;
            height: 100%;
        }
    }
</style>
