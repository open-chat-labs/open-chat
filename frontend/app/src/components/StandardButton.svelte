<script lang="ts">
    import { Button } from "component-lib";
    import { onMount } from "svelte";
    import { currentTheme } from "../theme/themes";
    import { darkenHexColour } from "../theme/utils";
    import type { ButtonProps } from "./Button.svelte";
    import Spinner from "./icons/Spinner.svelte";

    let {
        cls = "",
        loading = false,
        disabled = false,
        secondary = false,
        small = false,
        tiny = false,
        fill = false,
        hollow = false,
        title = undefined,
        square = false,
        danger = false,
        children,
        onClick,
    }: ButtonProps = $props();

    function rand(a: number, b: number) {
        const r = Math.random();
        return a + r * (b - a);
    }

    let height = $state("100px");
    let width = $state("50px");

    onMount(() => {
        const h = rand(50, 150);
        height = `${h}px`;
        width = `${h / 2}px`;
    });

    let darkenedDanger = $derived(darkenHexColour($currentTheme.toast.failure.bg, 20));

    function click(e: MouseEvent) {
        if (onClick) {
            e.stopPropagation();
            onClick(e);
        }
    }
</script>

<Button onClick={() => alert("click")}>Storybook is an utter piece of shit</Button>

<button
    style={`--height: ${height}; --width: ${width}; --darkened-danger: ${darkenedDanger}`}
    onclick={click}
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
        {@render children?.()}
    {:else}
        <Spinner backgroundColour={"rgba(0,0,0,0.3)"} foregroundColour={"var(--button-spinner)"} />
    {/if}
</button>

<style lang="scss">
    button {
        transition:
            border ease-in-out 200ms,
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

        &.loading {
            display: flex;
            align-items: center;
            justify-content: center;
        }

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
            background: transparent;
            color: var(--button-hollow-txt);
            border: var(--bw) solid var(--button-hollow-bd);
        }

        &.disabled {
            background: var(--button-disabled);
            color: var(--button-disabled-txt);
            cursor: not-allowed;
            border: var(--bw) solid var(--button-disabled-bd);
        }

        &.secondary {
            background: none;
            color: var(--button-secondary-txt);
            border: var(--bw) solid var(--button-secondary-bd);

            @media (hover: hover) {
                &:hover {
                    border: var(--bw) solid var(--button-secondary-bd-hv);
                    color: var(--button-secondary-txt-hv);
                }
            }
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
