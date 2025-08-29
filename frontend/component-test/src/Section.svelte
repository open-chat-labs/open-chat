<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
</script>

<div class="section">
    {@render children()}
</div>

<style lang="scss">
    .section {
        padding: var(--sp-xl);
        border: 1px dashed #9747ff;
        border-radius: var(--sp-md);
        gap: var(--sp-md);
    }
</style>
