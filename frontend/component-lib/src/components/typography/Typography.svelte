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
    }: Props = $props();

    let parentDirection = getContext<Direction>("direction");
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss}; color: var(--text-${colour});`);
</script>

{#if type === "overview" || type === "h1"}
    <h1 class:ellipsis={ellipsisTruncate} {style} class={`${type} ${fontWeight}`}>
        {@render children?.()}
    </h1>
{:else if type === "h2"}
    <h2 class:ellipsis={ellipsisTruncate} {style} class={`${type} ${fontWeight}`}>
        {@render children?.()}
    </h2>
{:else if type === "title"}
    <h3 class:ellipsis={ellipsisTruncate} {style} class={`${type} ${fontWeight}`}>
        {@render children?.()}
    </h3>
{:else if type === "subtitle"}
    <h5 class:ellipsis={ellipsisTruncate} {style} class={`${type} ${fontWeight}`}>
        {@render children?.()}
    </h5>
{:else}
    <p class:ellipsis={ellipsisTruncate} {style} class={`${type} ${fontWeight}`}>
        {@render children?.()}
    </p>
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
