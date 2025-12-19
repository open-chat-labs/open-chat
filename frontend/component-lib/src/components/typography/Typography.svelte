<script module lang="ts">
    export type TypographyProps = Omit<Props, "type">;

    interface Props {
        type: TypographicStyleName;
        fontWeight?: FontWeight;
        children?: Snippet;
        width?: SizeMode;
        height?: SizeMode;
        ellipsisTruncate?: boolean;
        colour?: ColourVarKeys;
        labelFor?: string;
        align?: "start" | "end" | "center" | "unset";
        uppercase?: boolean;
        onClick?: () => void;
        blur?: boolean;
    }
</script>

<script lang="ts">
    import {
        ColourVars,
        getFlexStyle,
        type ColourVarKeys,
        type Direction,
        type FontWeight,
        type SizeMode,
        type TypographicStyleName,
    } from "component-lib";
    import { getContext, type Snippet } from "svelte";

    let {
        fontWeight = "normal",
        type,
        children,
        width = "fill",
        height = "hug",
        ellipsisTruncate = false,
        colour = "textPrimary",
        labelFor,
        align = "unset",
        uppercase = false,
        onClick,
        blur = false,
    }: Props = $props();

    let parentDirection = getContext<Direction>("direction");
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(
        `${heightCss}; ${widthCss}; color: ${getColourVar()}; text-align:${align};`,
    );
    let tag = $derived(getTag());

    function getTag() {
        switch (type) {
            case "overview":
            case "h1":
                return "h1";
            case "h2":
                return "h2";
            case "h3":
            case "title":
                return "h3";
            case "subtitle":
                return "h5";
            case "label":
                return "label";
            default:
                return "span";
        }
    }
    function getColourVar() {
        return ColourVars[colour];
    }
</script>

{#if type === "label"}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <label
        onclick={onClick}
        class:uppercase
        class:blur
        for={labelFor}
        class:ellipsis={ellipsisTruncate}
        {style}
        class={`typo ${type} ${fontWeight}`}>
        {@render children?.()}
    </label>
{:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svelte:element
        this={tag}
        onclick={onClick}
        class:uppercase
        class:blur
        class:ellipsis={ellipsisTruncate}
        {style}
        class={`typo ${type} ${fontWeight}`}>
        {@render children?.()}
    </svelte:element>
{/if}

<style lang="scss">
    h1,
    h2,
    h3,
    h5,
    p {
        margin: 0;
        padding: 0;
    }

    .typo {
        transition: filter ease-in-out 250ms;
    }

    .overview {
        font-size: var(--typo-overview-sz);
        line-height: var(--typo-overview-lh);
    }
    .h1 {
        font-size: var(--typo-h1-sz);
        line-height: var(--typo-h1-lh);
    }
    .h2 {
        font-size: var(--typo-h2-sz);
        line-height: var(--typo-h2-lh);
    }
    .h3 {
        font-size: var(--typo-h3-sz);
        line-height: var(--typo-h3-lh);
    }
    .title {
        font-size: var(--typo-title-sz);
        line-height: var(--typo-title-lh);
    }
    .subtitle {
        font-size: var(--typo-subtitle-sz);
        line-height: var(--typo-subtitle-lh);
    }
    .body {
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);
    }
    .bodySmall {
        font-size: var(--typo-bodySmall-sz);
        line-height: var(--typo-bodySmall-lh);
    }
    .caption {
        font-size: var(--typo-caption-sz);
        line-height: var(--typo-caption-lh);
    }
    .label {
        font-size: var(--typo-label-sz);
        line-height: var(--typo-label-lh);
    }
    .chatLabel {
        font-size: var(--typo-chatLabel-sz);
        line-height: var(--typo-chatLabel-lh);
    }
    .chatText {
        font-size: var(--typo-chatText-sz);
        line-height: var(--typo-chatText-lh);
    }
    .chatFootnote {
        font-size: var(--typo-chatFootnote-sz);
        line-height: var(--typo-chatFootnote-lh);
    }
    .chatCaption {
        font-size: var(--typo-chatCaption-sz);
        line-height: var(--typo-chatCaption-lh);
    }
    .buttonSmall {
        font-size: var(--typo-buttonSmall-sz);
        line-height: var(--typo-buttonSmall-lh);
    }

    .light {
        font-weight: var(--font-weight-light);
    }

    .normal {
        font-weight: var(--font-weight-normal);
    }

    .semi-bold {
        font-weight: var(--font-weight-semi-bold);
    }

    .bold {
        font-weight: var(--font-weight-bold);
    }

    .ellipsis {
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .uppercase {
        text-transform: uppercase;
    }

    .blur {
        filter: blur(8px);
    }
</style>
