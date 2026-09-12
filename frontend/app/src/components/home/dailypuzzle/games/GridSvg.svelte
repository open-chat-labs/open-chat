<script lang="ts">
    import type { Snippet } from "svelte";
    import { CELL } from "./gridSvg";

    // The SVG frame every board and pictogram draws into. Children draw in gridSvg.ts units
    // (CELL per cell, top-left cell at the origin); `margin` reserves whole cells outside the
    // grid for row/column counts. Puzzle colours are fixed on purpose: a board reads the same
    // in every theme, so nothing here uses theme variables. The whole viewBox, margin included,
    // is painted light first: counts, border clues and edge lines drawn in the margin would
    // otherwise sit on the app background, which is dark in dark themes.
    interface Props {
        width: number;
        height: number;
        /** Cells of space outside the grid: [top, right, bottom, left]. */
        margin?: [number, number, number, number];
        /** Draw the grid's outer border. */
        frame?: boolean;
        /** Result-card pictogram: fills its (square) wrapper, no interaction. */
        compact?: boolean;
        disabled?: boolean;
        children: Snippet;
    }

    let {
        width,
        height,
        margin = [0, 0, 0, 0],
        frame = true,
        compact = false,
        disabled = false,
        children,
    }: Props = $props();

    const FRAME = 0.8;

    let w = $derived(width * CELL);
    let h = $derived(height * CELL);
    let bounds = $derived.by(() => {
        const [top, right, bottom, left] = margin;
        return {
            x: -left * CELL,
            y: -top * CELL,
            width: w + (left + right) * CELL,
            height: h + (top + bottom) * CELL,
        };
    });
    let viewBox = $derived(`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
</script>

<svg
    class="board"
    class:compact
    class:disabled
    {viewBox}
    preserveAspectRatio="xMidYMid meet"
    role={compact ? "img" : "grid"}>
    <rect {...bounds} fill="#ffffff" />
    {#if frame}
        <!-- under the board so clues on the boundary (Slant's vertex circles) paint over it; the
             stroke sits wholly outside the grid so cell fills don't cover half of it -->
        <rect
            x={-FRAME / 2}
            y={-FRAME / 2}
            width={w + FRAME}
            height={h + FRAME}
            fill="none"
            stroke="#1f1f1f"
            stroke-width={FRAME} />
    {/if}
    {@render children()}
</svg>

<style lang="scss">
    .board {
        display: block;
        width: 100%;
        height: auto;
        max-height: 100%;
        // the frame and strokes centred on the grid edge (border edges) extend past the viewBox
        overflow: visible;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;

        &:not(.compact):not(.disabled) :global([role="gridcell"]) {
            cursor: pointer;
        }

        &.compact {
            width: 100%;
            height: 100%;
        }
    }
</style>
