<script lang="ts">
    import type { MainAxisAlignment } from "component-lib";
    import { Container } from "component-lib";
    import { type Snippet } from "svelte";

    interface Props {
        align?: "end" | "fill" | "center" | "start"; // we may need more options later but I think this covers it at the moment
        nowrap?: boolean;
        nogap?: boolean;
        children?: Snippet;
    }

    let { align = "end", nowrap = false, nogap = false, children }: Props = $props();

    function alignment(align: "end" | "fill" | "center" | "start"): MainAxisAlignment {
        switch (align) {
            case "center":
                return "center";
            case "end":
                return "end";
            case "start":
                return "start";
            case "fill":
                "spaceBetween";
        }
        return "start";
    }
</script>

<Container
    wrap={!nowrap}
    supplementalClass={`button-group ${align === "fill" ? "fill" : ""}`}
    gap={nogap ? "zero" : "sm"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={alignment(align)}>
    {@render children?.()}
</Container>

<style lang="scss">
    :global(.button-group.fill button) {
        flex: auto;
    }
</style>
