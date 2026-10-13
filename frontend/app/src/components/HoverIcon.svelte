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

    function click() {
        if (!disabled) {
            onclick?.();
        }
    }

    // Enter and Space click the icon, as they would a native button, so wrappers which handle
    // the click themselves (such as MenuIcon) respond to them too. The key stops here so that
    // window and document listeners for Enter don't act on it a second time.
    function keydown(e: KeyboardEvent & { currentTarget: HTMLDivElement }) {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;

        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            e.currentTarget.click();
        }
    }
</script>

<div
    onclick={click}
    onkeydown={keydown}
    {tabindex}
    class="wrapper"
    class:compact
    class:disabled
    role="button"
    aria-disabled={disabled}
    {title}>
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
