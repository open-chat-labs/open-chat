<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        compact?: boolean;
        title?: string | undefined;
        disabled?: boolean;
        tabindex?: number;
        children?: Snippet;
        onclick?: () => void;
    }

    let {
        compact = false,
        title = undefined,
        disabled = false,
        tabindex = 0,
        children,
        onclick,
    }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div {onclick} {tabindex} class="wrapper" class:compact class:disabled role="button" {title}>
    {@render children?.()}
</div>

<style lang="scss">
    .wrapper {
        padding: $sp3;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: transparent;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;
        aspect-ratio: 1 / 1;

        &.compact {
            padding: $sp2;
        }

        &:not(.disabled):hover {
            background-color: var(--icon-hv);
        }
    }
</style>
