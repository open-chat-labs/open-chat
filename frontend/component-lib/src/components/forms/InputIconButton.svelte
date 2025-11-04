<script lang="ts">
    import { ColourVars } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        onClick: () => void;
        children: Snippet<[string]>;
    }

    let { children, onClick }: Props = $props();
</script>

<button
    onclick={(e) => {
        e.preventDefault();
        onClick();
    }}
    class="input_icon_button">
    {@render children(ColourVars.textPrimary)}
</button>

<style lang="scss">
    :global(.input_icon_button svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    .input_icon_button {
        all: unset;
        display: flex;
        width: 3rem;
        height: 3rem;
        background-color: var(--background-1);
        border-radius: var(--rad-circle);
        justify-content: center;
        align-items: center;
        cursor: pointer;
    }
</style>
