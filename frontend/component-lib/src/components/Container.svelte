<script lang="ts">
    import { getContext, setContext, type Snippet } from "svelte";
    import {
        getAlignmentCss,
        getBorderRadiusCss,
        getBorderStyleCss,
        getBorderWidthCss,
        getFlexStyle,
        getGapCss,
        getPaddingCss,
        type BorderRadiusSize,
        type BorderWidthSize,
        type CrossAxisAlignment,
        type Direction,
        type MainAxisAlignment,
        type Padding,
        type SizeMode,
        type SpacingSize,
    } from "../theme";

    interface Props {
        children: Snippet;
        direction?: Direction;
        gap?: SpacingSize;
        padding?: Padding;
        borderWidth?: BorderWidthSize;
        borderRadius?: BorderRadiusSize;
        borderStyle?: string;
        borderColour?: string;
        width?: SizeMode;
        height?: SizeMode;
        colour?: string;
        mainAxisAlignment?: MainAxisAlignment;
        crossAxisAlignment?: CrossAxisAlignment;
    }

    let {
        children,
        direction = "horizontal",
        gap = "zero",
        padding = ["zero"],
        borderWidth = "zero",
        borderRadius = "zero",
        width = { kind: "fill" },
        height = { kind: "hug" },
        colour,
        borderStyle = "solid",
        borderColour = "var(--background-2)",
        mainAxisAlignment = "start",
        crossAxisAlignment = "start",
    }: Props = $props();

    // you might expect this to be done inside onMount but
    // that runs from the bottom of the tree up which is not what we need
    let parentDirection = getContext<Direction>("direction");
    setContext("direction", direction);

    let paddingCss = $derived(getPaddingCss(padding));
    let borderWidthCss = $derived(getBorderWidthCss(borderWidth));
    let borderRadiusCss = $derived(getBorderRadiusCss(borderRadius));
    let borderStyleCss = $derived(getBorderStyleCss(borderWidth, borderStyle, borderColour));
    let gapCss = $derived(getGapCss(gap));
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let colourCss = $derived(colour ? `background-color: ${colour}` : "");
    let alignmentCss = $derived(getAlignmentCss(mainAxisAlignment, crossAxisAlignment));
    let style = $derived(
        `${alignmentCss}; ${colourCss}; ${heightCss}; ${widthCss}; ${borderStyleCss}; ${borderRadiusCss}; ${borderWidthCss}; ${paddingCss}; ${gapCss};`,
    );
</script>

<div {style} class={`container ${direction}`}>
    {@render children()}
</div>

<style lang="scss">
    .container {
        position: relative;
        transition:
            padding ease-in-out 200ms,
            gap ease-in-out 200ms;

        &.horizontal {
            display: flex;
            flex-direction: row;
        }

        &.vertical {
            display: flex;
            flex-direction: column;
        }
    }

    .debug {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        background-color: rgba(255, 255, 255, 0.3);
        border: 1px solid #000;
        border-radius: 8px;
    }
</style>
