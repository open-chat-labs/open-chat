<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        disabled?: boolean;
        onClick?: (e: MouseEvent) => void;
    }
    let { children, disabled = false, onClick }: Props = $props();
</script>

<button onclick={onClick} {disabled}>
    {@render children()}
</button>
