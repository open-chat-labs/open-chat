<script lang="ts">
    import type { Snippet } from "svelte";
    import { type BorderRadiusSize, type BorderWidthSize, type SpacingSize } from "../theme";

    export type Padding =
        | [SpacingSize]
        | [SpacingSize, SpacingSize]
        | [SpacingSize, SpacingSize, SpacingSize]
        | [SpacingSize, SpacingSize, SpacingSize, SpacingSize];

    interface Props {
        children: Snippet;
        direction?: "horizontal" | "vertical";
        gap?: SpacingSize;
        padding?: Padding;
        borderWidth?: BorderWidthSize;
        borderRadius?: BorderRadiusSize;
    }

    let {
        children,
        direction = "horizontal",
        gap = "zero",
        padding = ["zero"],
        borderWidth = "zero",
        borderRadius = "zero",
    }: Props = $props();

    let paddingCss = $derived(`padding: ${padding.map((p) => `var(--sp-${p})`).join(" ")}`);
    let borderWidthCss = $derived(`border-width: var(--bw-${borderWidth})`);
    let borderRadiusCss = $derived(`border-radius: var(--rad-${borderRadius})`);
    let borderStyleCss = $derived(
        borderWidth === "zero" ? "" : `border-style: solid; border-color: var(--background-2)`,
    );
    let gapCss = $derived(`gap: var(--sp-${gap})`);
    let style = $derived(
        `${borderStyleCss}; ${borderRadiusCss}; ${borderWidthCss}; ${paddingCss}; ${gapCss};`,
    );
</script>

<div {style} class={`container ${direction}`}>
    {@render children()}
</div>

<style lang="scss">
    .container {
        display: flex;

        &.horizontal {
            flex-direction: row;
        }

        &.vertical {
            flex-direction: column;
        }
    }
</style>
