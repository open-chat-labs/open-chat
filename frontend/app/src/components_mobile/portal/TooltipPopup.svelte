<script lang="ts">
    import { reposition, type Alignment, type NanoPopPosition, type Position } from "component-lib";
    import { mobileWidth } from "openchat-client";
    import { onMount, type Snippet } from "svelte";
    import { fade } from "svelte/transition";
    import { rtlStore } from "../../stores/rtl";
    import { portalState } from "../portalState.svelte";

    interface Props {
        children?: Snippet;
        trigger: HTMLElement;
        position?: Position;
        align?: Alignment;
        gutter?: number;
        autoWidth?: boolean;
        textLength?: number;
        longestWord?: number;
        uppercase?: boolean;
    }
    const {
        children,
        trigger,
        position = "top",
        align = "start",
        gutter = 8,
        autoWidth = false,
        textLength = 100,
        longestWord = 10,
        uppercase = false,
    }: Props = $props();

    let maxWidth = $derived(
        autoWidth ? "unset" : calculateMaxWidth(textLength, longestWord, $mobileWidth),
    );

    let container: HTMLElement | undefined;

    onMount(() => {
        if (container) {
            move(container);
        }

        setTimeout(() => {
            document.addEventListener("click", () => portalState.close(), { once: true });
        }, 100);
    });

    function move(container: HTMLElement) {
        reposition(trigger, container, {
            position: `${position}-${align}` as NanoPopPosition,
            margin: gutter,
        });
    }

    function calculateMaxWidth(textLength: number, longestWord: number, mobile: boolean): number {
        const MIN_WIDTH = mobile ? 100 : 140;
        const MAX_WIDTH = mobile ? 250 : 300;

        const CHAR_WIDTH = mobile ? 6 : 7;

        let numChars = textLength + 13;
        return (
            Math.max(
                longestWord * CHAR_WIDTH,
                Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.sqrt(numChars) * CHAR_WIDTH * 2)),
            ) / 16
        );
    }
</script>

{#if children}
    <span class="tooltip" bind:this={container}>
        <div
            transition:fade={{ duration: 100 }}
            class={`tooltip-popup ${position} ${align}`}
            class:rtl={$rtlStore}
            class:uppercase
            style={`max-width: ${maxWidth}rem;`}>
            {@render children()}
        </div>
    </span>
{/if}

<style lang="scss">
    .tooltip {
        position: absolute;
    }

    .tooltip-popup {
        background-color: var(--menu-bg);
        border: 1px solid var(--menu-bd);
        color: var(--menu-txt);
        $chevron: 8px;
        $offset: 12px;

        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
        @include z-index("tooltip");
        @include font-size(fs-50);
        width: max-content;
        padding: $sp3;
        border-radius: $sp3;
        pointer-events: none;
        word-wrap: break-word;

        &.uppercase {
            text-transform: uppercase;
        }

        &:after {
            display: block;
            position: absolute;
            background-color: inherit;
            width: $chevron;
            height: $chevron;
            transform: rotate(45deg);
            content: "";
        }

        &.right:after {
            left: -5px;
            border-bottom: 1px solid var(--menu-bd);
            border-left: 1px solid var(--menu-bd);
        }

        &.right.rtl:after {
            left: unset;
            right: -5px;
            border-bottom: none;
            border-left: none;
            border-top: 1px solid var(--menu-bd);
            border-right: 1px solid var(--menu-bd);
        }

        &.left:after {
            right: -5px;
            border-top: 1px solid var(--menu-bd);
            border-right: 1px solid var(--menu-bd);
        }

        &.left.rtl:after {
            right: unset;
            left: -5px;
            border-top: none;
            border-right: none;
            border-bottom: 1px solid var(--menu-bd);
            border-left: 1px solid var(--menu-bd);
        }

        &.bottom:after {
            top: -5px;
            border-top: 1px solid var(--menu-bd);
            border-left: 1px solid var(--menu-bd);
        }

        &.top:after {
            bottom: -5px;
            border-bottom: 1px solid var(--menu-bd);
            border-right: 1px solid var(--menu-bd);
        }

        &.left.start:after,
        &.right.start:after {
            top: $offset;
        }
        &.left.end:after,
        &.right.end:after {
            bottom: $offset;
        }
        &.left.center:after,
        &.right.center:after {
            top: calc(50% - 4px);
        }

        &.top.start:after,
        &.bottom.start:after {
            left: $offset;
        }
        &.top.rtl.start:after,
        &.bottom.rtl.start:after {
            left: unset;
            right: $offset;
        }
        &.top.end:after,
        &.bottom.end:after {
            right: $offset;
        }
        &.top.rtl.end:after,
        &.bottom.rtl.end:after {
            right: unset;
            left: $offset;
        }
    }
</style>
