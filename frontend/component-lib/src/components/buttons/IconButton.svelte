<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        disabled?: boolean;
        onclick?: () => void;
    }

    let { children, onclick, disabled = false }: Props = $props();
</script>

<button class="icon_button" {disabled} type={"button"} {onclick}>
    {@render children()}
</button>

<style lang="scss">
    :global(.icon_button svg) {
        width: var(--icon-lg);
        height: var(--icon-lg);
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
