<!-- A keyboard-area panel's handle (native plan 06 "Dragging the handle"): the 48 × 4px bar in its
     drag zone, the only part of a row that drags the sheet. Enter or Space grows a resting sheet,
     takes a grown one back to rest, or, one that doesn't grow, closes it. -->
<script lang="ts">
    import { panelDragHandle } from "./panelDragHandle";
    import type { KeyboardPanelState } from "./panelState.svelte";

    type Props = {
        panel: KeyboardPanelState;
        /** What dragging it does. */
        label: string;
        /** The zone: the emoji panel's 22px row, or a 96 × 44px zone in the attach panel's top row. */
        zone?: "row" | "centre";
        onClose: () => void;
    };

    let { panel, label, zone = "row", onClose }: Props = $props();

    function key(e: KeyboardEvent) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (!panel.expandable) onClose();
        else if (panel.open) panel.rest();
        else panel.expand();
    }
</script>

<div
    class="zone {zone}"
    role="button"
    tabindex="0"
    aria-label={label}
    onkeydown={key}
    {@attach panelDragHandle(panel)}
>
    <span class="handle"></span>
</div>

<style lang="scss">
    .zone {
        flex: none;
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        touch-action: none;
        cursor: grab;
        -webkit-tap-highlight-color: transparent;

        // 07: a 22px row, the bar 8px down (10px over the row under it)
        &.row {
            height: 22px;
            padding-block-start: var(--space-8);
        }

        // 06: 96 × 44px, the bar in the middle
        &.centre {
            width: 96px;
            height: 44px;
            align-items: center;
        }
    }

    .handle {
        width: 48px;
        height: 4px;
        border-radius: 2px;
        background: var(--overlay-3);
    }
</style>
