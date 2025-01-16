<script lang="ts">
    import { onMount } from "svelte";
    import { currentTheme } from "../theme/themes";
    import { darkenHexColour } from "../theme/utils";

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
    export let danger: boolean = false;

    function rand(a: number, b: number) {
        const r = Math.random();
        return a + r * (b - a);
    }

    let height = "100px";
    let width = "50px";

    onMount(() => {
        const h = rand(50, 150);
        height = `${h}px`;
        width = `${h / 2}px`;
    });

    $: darkenedDanger = darkenHexColour($currentTheme.toast.failure.bg, 20);
</script>

<button
    style={`--height: ${height}; --width: ${width}; --darkened-danger: ${darkenedDanger}`}
    on:click|stopPropagation
    class={cls}
    class:halloween={$currentTheme.name === "halloween"}
    class:loading
    class:disabled
    class:small
    class:tiny
    class:hollow
    class:danger
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
        transition:
            background ease-in-out 200ms,
            color ease-in-out 200ms;
        background: var(--button-bg);
        color: var(--button-txt);
        padding: $sp3 $sp6;
        border-radius: var(--button-rd);
        cursor: pointer;
        border: none;
        min-height: 45px;
        min-width: 150px;
        position: relative;
        @include font(book, normal, fs-100, 20);
        text-shadow: var(--button-txt-sh);
        box-shadow: var(--button-sh);

        &:hover {
            box-shadow: var(--buton-hv-sh);
        }

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

        @media (hover: hover) {
            &:hover {
                background: var(--button-hv);
                color: var(--button-hv-txt);
            }
        }

        &.danger {
            background: var(--toast-failure-bg);
            color: var(--toast-failure-txt);
            @media (hover: hover) {
                &:hover {
                    background: var(--darkened-danger);
                }
            }
        }

        &.hollow {
            background-color: transparent;
            color: var(--txt);
            border: var(--bw) solid var(--bd);
        }

        &.disabled {
            background: var(--button-disabled);
            color: var(--button-disabled-txt);
            cursor: not-allowed;
            border: var(--bw) solid var(--button-disabled-bd);
        }

        &.secondary {
            background: none;
            color: var(--txt-light);
            border: var(--bw) solid var(--bd);
        }

        &.fill {
            width: 100%;
            height: 100%;
        }

        &.halloween::after {
            content: "";
            display: block;
            background-image: url("/assets/spider.svg");
            background-repeat: no-repeat;
            background-size: contain;
            width: var(--width);
            height: var(--height);
            position: absolute;
            top: calc(100% - 1px);
            left: calc(50% - var(--width) / 2);
            @include z-index("spider");
            pointer-events: none;
            animation: pulse 3s linear infinite;
            transform-origin: top;
        }

        &.loading {
            @include loading-spinner(
                1em,
                0.5em,
                var(--button-spinner),
                "/assets/plain-spinner.svg"
            );
        }
    }

    @keyframes pulse {
        0% {
            transform: scale(0.95);
        }
        50% {
            transform: scale(1.05);
        }
        100% {
            transform: scale(0.95);
        }
    }
</style>
