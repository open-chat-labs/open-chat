<script lang="ts">
    import { reposition, type Alignment, type NanoPopPosition, type Position } from "component-lib";
    import { onMount, type Snippet } from "svelte";
    import { fade } from "svelte/transition";

    interface Props {
        children: Snippet;
        trigger: HTMLElement;
        position?: Position;
        align?: Alignment;
        onClose: () => void;
        uppercase?: boolean;
        autoWidth?: boolean;
        textLength?: number;
        longestWord?: number;
    }
    const {
        uppercase = false,
        children,
        onClose,
        trigger,
        position = "top",
        align = "middle",
        autoWidth = false,
        textLength = 100,
        longestWord = 10,
    }: Props = $props();

    let maxWidth = $derived(autoWidth ? "unset" : calculateMaxWidth(textLength, longestWord));
    let container: HTMLElement | undefined;

    onMount(() => {
        if (container) {
            move(container);
        }

        setTimeout(() => {
            document.addEventListener("click", onClose, { once: true });
        }, 100);
    });

    function move(container: HTMLElement) {
        reposition(trigger, container, {
            position: `${position}-${align}` as NanoPopPosition,
            margin: 8,
        });
    }

    function calculateMaxWidth(textLength: number, longestWord: number): number {
        const MIN_WIDTH = 100;
        const MAX_WIDTH = 250;
        const CHAR_WIDTH = 6;

        let numChars = textLength + 13;
        return (
            Math.max(
                longestWord * CHAR_WIDTH,
                Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.sqrt(numChars) * CHAR_WIDTH * 2)),
            ) / 16
        );
    }
</script>

<span class="tooltip" bind:this={container}>
    <div
        class:uppercase
        transition:fade={{ duration: 100 }}
        class={`tooltip-popup ${position} ${align}`}
        style={`max-width: ${maxWidth}rem;`}>
        {@render children()}
    </div>
</span>

<style lang="scss">
    .tooltip {
        position: absolute;
    }

    .tooltip-popup {
        background-color: var(--background-1);
        color: var(--text-primary);
        $chevron: 0.5rem;
        $offset: 0.75rem;

        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
        width: max-content;
        padding: var(--sp-md);
        border-radius: var(--rad-md);
        pointer-events: none;
        word-wrap: break-word;
        font-size: var(--typo-caption-sz);
        line-height: var(--typo-caption-lh);
        color: var(--text-primary);
        box-shadow: var(--menu-sh);
        z-index: 100;

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
            transform-origin: center;
            content: "";
        }

        &.right:after {
            left: -0.25rem;
        }

        &.left:after {
            right: -0.25rem;
        }

        &.bottom:after {
            top: -0.25rem;
        }

        &.top:after {
            bottom: -0.25rem;
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
            top: calc(50% - 0.25rem);
        }

        &.top.start:after,
        &.bottom.start:after {
            left: $offset;
        }
        &.top.end:after,
        &.bottom.end:after {
            right: $offset;
        }
    }
</style>
