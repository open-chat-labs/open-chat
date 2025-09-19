<script module lang="ts">
    export type TypographyProps = Omit<Props, "type">;

    interface Props {
        type: TypographicStyleName;
        fontWeight?: FontWeight;
        children?: Snippet;
        width?: SizeMode;
        height?: SizeMode;
        ellipsisTruncate?: boolean;
        colour?: TypographyColour;
        labelFor?: string;
    }
</script>

<script lang="ts">
    import {
        getFlexStyle,
        type Direction,
        type FontWeight,
        type SizeMode,
        type TypographicStyleName,
        type TypographyColour,
    } from "component-lib";
    import { getContext, type Snippet } from "svelte";

    let {
        fontWeight = "normal",
        type,
        children,
        width = { kind: "fill" },
        height = { kind: "hug" },
        ellipsisTruncate = false,
        colour = "primary",
        labelFor,
    }: Props = $props();

    let parentDirection = getContext<Direction>("direction");
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss}; color: ${getColourVar()};`);
    let tag = $derived(getTag());

    function getTag() {
        switch (type) {
            case "overview":
            case "h1":
                return "h1";
            case "h2":
                return "h2";
            case "title":
                return "h3";
            case "subtitle":
                return "h5";
            case "label":
                return "label";
            default:
                return "p";
        }
    }
    function getColourVar() {
        switch (colour) {
            case "error":
                return "var(--error)";
            default:
                return `var(--text-${colour})`;
        }
    }
</script>

{#if type === "label"}
    <label for={labelFor} class:ellipsis={ellipsisTruncate} {style} class={`${type} ${fontWeight}`}>
        {@render children?.()}
    </label>
{:else}
    <svelte:element
        this={tag}
        class:ellipsis={ellipsisTruncate}
        {style}
        class={`${type} ${fontWeight}`}>
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

    .light {
        font-weight: var(--font-light);
    }

    .normal {
        font-weight: var(--font-normal);
    }

    .semi-bold {
        font-weight: var(--font-semi-bold);
    }

    .bold {
        font-weight: var(--font-bold);
    }

    .ellipsis {
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
