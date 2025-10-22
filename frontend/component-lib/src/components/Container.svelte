<script lang="ts">
    import {
        ColourVars,
        getAlignmentCss,
        getBorderRadiusCss,
        getBorderStyleCss,
        getBorderWidthCss,
        getFlexStyle,
        getGapCss,
        getPaddingCss,
        menuCloser,
        scrollLimits,
        swipe,
        type BorderWidthSize,
        type CrossAxisAlignment,
        type Direction,
        type MainAxisAlignment,
        type Padding,
        type Radius,
        type SizeMode,
        type SpacingSize,
        type SwipeDirection,
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
        parentDirection?: Direction;
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
        mainAxisSelfAlignment?: MainAxisAlignment;
        crossAxisSelfAlignment?: CrossAxisAlignment;
        minWidth?: string;
        minHeight?: string;
        maxWidth?: string;
        maxHeight?: string;
        shadow?: string;
        background?: string;
        backgroundImage?: string;
        onClick?: (e?: MouseEvent) => void;
        supplementalClass?: string;
        allowOverflow?: boolean;
        tag?: "div" | "button" | "main" | "section"; // this could be just about anything but let's try to limit it
        id?: string;
        onInsideStart?: (fromStart: number) => void;
        onInsideEnd?: (fromEnd: number) => void;
        onSwipe?: (direction: SwipeDirection) => void;
        closeMenuOnScroll?: boolean;
        wrap?: boolean;
        ref?: HTMLElement;
        clientHeight?: number;
        clientWidth?: number;
        reverse?: boolean;
        data_id?: string; //todo find a better way to do this
        data_index?: string; // tod fine a better way to do this
    }

    let {
        children,
        direction = "horizontal",
        parentDirection = "unknown",
        gap = "zero",
        padding = "zero",
        borderWidth = "zero",
        borderRadius = "zero",
        width = { kind: "fill" },
        height = { kind: "hug" },
        colour,
        borderStyle = "solid",
        borderColour = ColourVars.background2,
        mainAxisAlignment = "start",
        crossAxisAlignment = "start",
        mainAxisSelfAlignment,
        crossAxisSelfAlignment,
        minWidth = "auto",
        minHeight = "auto",
        maxWidth = "auto",
        maxHeight = "auto",
        shadow,
        background = "unset",
        backgroundImage,
        onClick,
        supplementalClass,
        allowOverflow = false,
        tag = "div",
        id,
        onInsideEnd,
        onInsideStart,
        onSwipe,
        closeMenuOnScroll = false,
        wrap = false,
        ref = $bindable(),
        clientHeight = $bindable(),
        clientWidth = $bindable(),
        reverse = false,
        data_id,
        data_index,
    }: Props = $props();

    // you might expect this to be done inside onMount but
    // that runs from the bottom of the tree up which is not what we need
    parentDirection = getContext<Direction>("direction") ?? parentDirection;
    setContext("direction", direction);

    let paddingCss = $derived(getPaddingCss(padding));
    let borderWidthCss = $derived(getBorderWidthCss(borderWidth));
    let borderRadiusCss = $derived(getBorderRadiusCss(borderRadius));
    let borderStyleCss = $derived(getBorderStyleCss(borderWidth, borderStyle, borderColour));
    let gapCss = $derived(getGapCss(gap));
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let colourCss = $derived(colour ? `background-color: ${colour}` : "");
    let wrapCss = $derived(wrap ? "flex-wrap: wrap;" : "");
    let alignmentCss = $derived(
        getAlignmentCss(
            mainAxisAlignment,
            crossAxisAlignment,
            mainAxisSelfAlignment,
            crossAxisSelfAlignment,
        ),
    );
    let backgroundCss = $derived(
        backgroundImage
            ? `background-image: url(${backgroundImage});`
            : background
              ? `background: ${background};`
              : "",
    );
    let style = $derived(
        `${wrapCss} ${backgroundCss} box-shadow: ${shadow}; max-width: ${maxWidth}; max-height: ${maxHeight}; min-width: ${minWidth}; min-height: ${minHeight}; ${alignmentCss}; ${colourCss}; ${heightCss}; ${widthCss}; ${borderStyleCss}; ${borderRadiusCss}; ${borderWidthCss}; ${paddingCss}; ${gapCss};`,
    );
    // TODO I think it might be nice to do a lot of this flex sizing with classes rather than inline styles
    // although I'm not sure I can say *why*
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:element
    this={tag}
    data-id={data_id}
    data-index={data_index}
    bind:clientHeight
    bind:clientWidth
    role={onClick ? "button" : "none"}
    bind:this={ref}
    use:menuCloser={closeMenuOnScroll}
    use:swipe={{ onSwipe }}
    use:scrollLimits={{ onEnd: onInsideEnd, onStart: onInsideStart }}
    {id}
    class:clickable={onClick !== undefined}
    class:overflow={allowOverflow}
    class:reverse
    onclick={onClick}
    {style}
    class={`container ${direction} ${supplementalClass ?? ""}`}>
    {@render children()}
</svelte:element>

<style lang="scss">
    .container {
        overflow: auto;
        scrollbar-width: none;
        position: relative;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        transition:
            border-radius 200ms ease-in-out,
            margin 200ms ease-in-out,
            min-width 200ms ease-in-out,
            flex-basis 200ms ease-in-out,
            padding 200ms ease-in-out,
            gap 200ms ease-in-out;

        &.overflow {
            overflow: visible;
        }

        &.horizontal {
            display: flex;
            flex-direction: row;
            &.reverse {
                flex-direction: row-reverse;
            }
        }

        &.vertical {
            display: flex;
            flex-direction: column;
            &.reverse {
                flex-direction: column-reverse;
            }
        }

        &.clickable {
            cursor: pointer;
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
