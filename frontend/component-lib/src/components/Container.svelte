<script lang="ts">
    import {
        getAlignmentCss,
        getBorderRadiusCss,
        getBorderStyleCss,
        getBorderWidthCss,
        getFlexStyle,
        getGapCss,
        getPaddingCss,
        Pixel,
        type BorderWidthSize,
        type CrossAxisAlignment,
        type Direction,
        type MainAxisAlignment,
        type Padding,
        type Radius,
        type SizeMode,
        type SpacingSize,
    } from "component-lib";
    import { getContext, setContext, type Snippet } from "svelte";

    /**
     * Some notes on usage. This component uses the Figma concepts of Hug and Fill which need to be understood to use it properly.
     * Width and height are expressed using a SizeMode. SizeMode can be "hug", "fill" or "fixed".
     * Hug is used to express that a container's width (e.g.) should be dictated by the intrinsic width of its children.
     * Fill is used to express that a child should use all available space as dictated by its parent.
     * Fixed is used to express that the container should simply occupy a fixed width.
     *
     * This is powerful and flexible system but it has some implications that need to be understood:
     *
     * The overall width/height _must_ be defined by either the parent or the children. You cannot declare that each is
     * relying on the other to define the size. For example, if you have a parent container that has "hug" width this
     * means that its width will be defined by the widths of its children. But if those children have "fill" width this
     * means that their widths will be defined by the width of the parent and we have a deadly embrace and may well get
     * unexpected results. This can always be resolved but only if you understand what is going on.
     */

    interface Props {
        children: Snippet;
        direction?: Direction;
        gap?: SpacingSize;
        padding?: Padding;
        borderWidth?: BorderWidthSize;
        borderRadius?: Radius;
        borderStyle?: string;
        borderColour?: string;
        width?: SizeMode;
        height?: SizeMode;
        colour?: string;
        mainAxisAlignment?: MainAxisAlignment;
        crossAxisAlignment?: CrossAxisAlignment;
        minWidth?: Pixel;
        minHeight?: Pixel;
        shadow?: string;
        backgroundColour?: string;
    }

    let {
        children,
        direction = "horizontal",
        gap = "zero",
        padding = "zero",
        borderWidth = "zero",
        borderRadius = "zero",
        width = { kind: "fill" },
        height = { kind: "hug" },
        colour,
        borderStyle = "solid",
        borderColour = "var(--background-2)",
        mainAxisAlignment = "start",
        crossAxisAlignment = "start",
        minWidth = new Pixel(0),
        minHeight = new Pixel(0),
        shadow,
        backgroundColour = "unset",
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
        `background-color: ${backgroundColour}; box-shadow: ${shadow}; min-width: ${minWidth}; min-height: ${minHeight}; ${alignmentCss}; ${colourCss}; ${heightCss}; ${widthCss}; ${borderStyleCss}; ${borderRadiusCss}; ${borderWidthCss}; ${paddingCss}; ${gapCss};`,
    );
</script>

<div {style} class={`container ${direction}`}>
    {@render children()}
</div>

<style lang="scss">
    .container {
        overflow: auto;
        scrollbar-width: none;
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
