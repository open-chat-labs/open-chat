<script lang="ts">
    import { type Snippet } from "svelte";

    interface Props {
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
        disabled?: boolean;
    }
    let { icon, onClick, disabled = false }: Props = $props();
</script>

<button class="floating_button" {disabled} type="button" onclick={onClick}>
    {@render icon("var(--text-on-primary)")}
</button>

<style lang="scss">
    // This has to be done like this because we can't size using css vars for svg elements for some reason
    :global(.floating_button > svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    button {
        width: 3.5rem;
        height: 3.5rem;
        background: var(--gradient-inverted);
        color: var(--text-primary);
        border-radius: var(--rad-lg);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
</style>
