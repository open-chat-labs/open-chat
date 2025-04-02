<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        underline?: "never" | "always" | "hover";
        children?: Snippet;
        onClick?: () => void;
    }

    let { underline = "never", children, onClick }: Props = $props();

    let anchorElement: HTMLElement | undefined;

    export function getBoundingRect(): DOMRect | undefined {
        return anchorElement?.getBoundingClientRect();
    }

    function click(e: MouseEvent) {
        if (onClick) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }
    }
</script>

<a
    bind:this={anchorElement}
    role="button"
    href="/"
    class={underline}
    class:hover={underline === "hover"}
    onclick={click}>
    {@render children?.()}
</a>

<style lang="scss">
    a {
        cursor: pointer;
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
        @media (hover: hover) {
            &:hover {
                text-decoration-thickness: 2px;
            }
        }
    }
</style>
