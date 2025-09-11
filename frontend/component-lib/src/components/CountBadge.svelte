<script lang="ts">
    import type { Snippet } from "svelte";

    type Mode = "default" | "additive";
    type Size = "default" | "large";
    interface Props {
        mode?: Mode;
        size?: Size;
        children: Snippet;
    }

    let { children, mode = "default", size = "default" }: Props = $props();
</script>

<div class={`badge ${mode}-mode ${size}-size`}>
    {@render children()}
</div>

<style lang="scss">
    .badge {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: var(--rad-circle);
        font-size: var(--typo-caption-sz);
        line-height: var(--typo-caption-lh);
        font-weight: var(--font-semi-bold);
        background: var(--tertiary);
        color: var(--text-on-primary);

        &.large-size {
            width: 1.75rem;
            height: 1.75rem;
            font-size: var(--typo-bodySmall-sz);
            line-height: var(--typo-bodySmall-lh);
        }

        &.additive-mode {
            background: var(--background-2);
            color: var(--text-placeholder);
        }
    }
</style>
