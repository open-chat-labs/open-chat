<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        disabled?: boolean;
        onclick?: () => void;
        size?: "xs" | "sm" | "md" | "lg";
    }

    let { children, onclick, disabled = false, size = "md" }: Props = $props();
</script>

<button class={`icon_button ${size}`} {disabled} type={"button"} {onclick}>
    {@render children()}
</button>

<style lang="scss">
    :global(.icon_button.lg svg) {
        width: var(--icon-lg);
        height: var(--icon-lg);
    }

    :global(.icon_button.md svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    :global(.icon_button.sm svg) {
        width: var(--icon-sm);
        height: var(--icon-sm);
    }

    :global(.icon_button.xs svg) {
        width: var(--icon-xs);
        height: var(--icon-xs);
    }

    button {
        all: unset;
        padding: var(--sp-sm);
        border-radius: var(--rad-circle);
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: transparent;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;
        aspect-ratio: 1 / 1;

        &:not(.disabled):hover {
            background-color: var(--background-2);
        }
    }
</style>
