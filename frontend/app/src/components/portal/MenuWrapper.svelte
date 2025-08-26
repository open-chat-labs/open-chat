<script lang="ts">
    import { centerOfScreen, type Alignment, type Position } from "@src/utils/alignment";
    import { reposition, type NanoPopPosition } from "@src/utils/position";
    import { mobileWidth } from "openchat-client";
    import { onMount, type Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        onClose: () => void;
        trigger: HTMLElement;
        centered?: boolean;
        position?: Position;
        align?: Alignment;
        gutter?: number;
    }
    const {
        children,
        onClose,
        trigger,
        centered = false,
        position = "bottom",
        align = "middle",
        gutter = 8,
    }: Props = $props();

    let container: HTMLElement | undefined;

    onMount(() => {
        if (container) {
            move(container);
        }

        setTimeout(() => {
            document.addEventListener("click", onClose, { once: true });
        }, 100);
    });

    function move(container: HTMLElement) {
        if (centered && $mobileWidth) {
            positionInCenter(container);
        } else {
            reposition(trigger, container, {
                position: `${position}-${align}` as NanoPopPosition,
                margin: gutter,
            });
        }
    }

    function positionInCenter(menu: HTMLElement) {
        const rect = menu.getBoundingClientRect();
        const dim = centerOfScreen(rect);
        menu.style.setProperty("left", `${dim.x}px`);
        menu.style.setProperty("top", `${dim.y + window.scrollY}px`);
    }
</script>

{#if children}
    <span bind:this={container} class="menu" onclick={onClose}>
        {@render children()}
    </span>
{/if}

<style lang="scss">
    .menu {
        position: fixed;
        @include z-index("popup-menu");
    }
</style>
