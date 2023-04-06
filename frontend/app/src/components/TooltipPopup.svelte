<script lang="ts">
    import { fade } from "svelte/transition";
    import { mobileWidth } from "../stores/screenDimensions";

    export let alignRight = false;
    export let textLength: number = 100;
    export let longestWord: number = 10;

    $: maxWidth = calculateMaxWidth(textLength, longestWord, $mobileWidth);

    function calculateMaxWidth(textLength: number, longestWord: number, mobile: boolean): number {
        const MIN_WIDTH = mobile ? 100 : 140;
        const MAX_WIDTH = mobile ? 250 : 300;

        const CHAR_WIDTH = mobile ? 6 : 7;

        let numChars = textLength + 13;
        return (
            Math.max(
                longestWord * CHAR_WIDTH,
                Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.sqrt(numChars) * CHAR_WIDTH * 2))
            ) / 16
        );
    }
</script>

<div
    transition:fade={{ duration: 100 }}
    class="tooltip-popup"
    class:right={alignRight}
    style={`max-width: ${maxWidth}rem;`}>
    <slot />
</div>

<style type="text/scss">
    .tooltip-popup {
        background-color: var(--menu-bg);
        border: 1px solid var(--menu-bd);
        color: var(--menu-txt);

        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
        @include z-index("tooltip");
        @include font-size(fs-50);
        width: max-content;
        padding: $sp2 $sp3 $sp3 $sp3;
        border-radius: $sp3;
        pointer-events: none;
        word-wrap: break-word;

        &.right {
            &:after {
                right: 18px;
                left: auto;
            }
        }

        &:after {
            display: block;
            position: absolute;
            background-color: inherit;
            width: 8px;
            height: 8px;
            bottom: -5px;
            left: 18px;
            transform: rotate(45deg);
            border-bottom: 1px solid var(--menu-bd);
            border-right: 1px solid var(--menu-bd);
            content: "";
        }
    }
</style>
