<script lang="ts">
    import { getContext, type Snippet } from "svelte";
    import {
        getFlexStyle,
        type Direction,
        type SizeMode,
        type TypographicStyleName,
    } from "../theme";

    interface Props {
        type: TypographicStyleName;
        children?: Snippet;
        width?: SizeMode;
        height?: SizeMode;
    }

    let { type, children, width = { kind: "fill" }, height = { kind: "hug" } }: Props = $props();

    let parentDirection = getContext<Direction>("direction");
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss};`);
</script>

{#if type === "overview" || type === "h1"}
    <h1 {style} class={`${type}`}>{@render children?.()}</h1>
{:else if type === "h2"}
    <h2 {style} class={`${type}`}>{@render children?.()}</h2>
{:else if type === "subtitle"}
    <h5 {style} class={`${type}`}>{@render children?.()}</h5>
{:else}
    <p {style} class={`${type}`}>{@render children?.()}</p>
{/if}

<style lang="scss">
    h1,
    h2,
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
</style>
