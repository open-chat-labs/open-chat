<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        underline?: "never" | "always" | "hover";
        light?: boolean;
        children?: Snippet;
        onClick?: (e: MouseEvent) => void;
    }

    let { underline = "never", light = false, children, onClick }: Props = $props();

    function click(e: MouseEvent) {
        e.stopPropagation();
        onClick?.(e);
    }
</script>

<span
    class={`link-button ${underline}`}
    class:hover={underline === "hover"}
    class:light
    onclick={click}>
    {@render children?.()}
</span>

<style lang="scss">
    span {
        cursor: pointer;
        color: var(--txt);
        display: inline-block;

        &.light {
            color: var(--txt-light);
        }
    }

    @media (hover: hover) {
        .hover:hover {
            text-decoration: underline;
            text-decoration-color: var(--accent);
            text-underline-offset: $sp2;
            text-decoration-thickness: 2px;
        }
    }

    .always {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp2;
        text-decoration-thickness: 2px;
    }
</style>
