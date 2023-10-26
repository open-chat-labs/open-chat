<script lang="ts" context="module">
    let index = 0;
</script>

<script lang="ts">
    import { onMount } from "svelte";

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

    let colors = ["rgb(248, 255, 131)", "rgb(56, 183, 240)", "rgb(227, 26, 62)"];
    let color = "";

    onMount(() => {
        color = colors[index];
        index = (index + 1) % 3;
    });
</script>

<button
    style={`--color: ${color}`}
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
        transition: background ease-in-out 200ms, color ease-in-out 200ms;
        background: white;
        color: black;
        padding: $sp3 $sp6;
        border-radius: 0;
        cursor: pointer;
        border: var(--bw) solid var(--bd);
        min-height: 45px;
        min-width: 150px;
        position: relative;
        @include font(book, normal, fs-100, 20);
        text-shadow: var(--button-txt-sh);
        box-shadow: 4px 4px 0 var(--color);

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

        &.loading {
            @include loading-spinner(
                1em,
                0.5em,
                var(--button-spinner),
                "/assets/plain-spinner.svg"
            );
        }

        &.disabled {
            background: var(--button-disabled);
            color: var(--button-disabled-txt);
            cursor: not-allowed;
        }

        &.secondary {
            color: var(--txt-light);
        }

        &.fill {
            width: 100%;
            height: 100%;
        }
    }
</style>
