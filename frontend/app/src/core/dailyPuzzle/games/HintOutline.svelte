<script lang="ts">
    // A hint's two roles, drawn the same in every game so every sentence can name them by look:
    // a solid outline round what the sentence is about (its subject, the hint's target), and a
    // dashed outline with a ? in the middle round a cell the player is asked to act on. No tint,
    // so the colours a sentence names stay true. A key that takes no mark (a clue, a tree, an
    // island) is never asked for, so it gets the solid outline even when it is not the subject.
    import { CELL } from "./gridSvg";

    interface Props {
        /** Top-left of the cell, in gridSvg.ts units. */
        x: number;
        y: number;
        /** Size in gridSvg.ts units; a cell by default. */
        width?: number;
        height?: number;
        subject: boolean;
        /** Whether the player can mark this key. Only a markable key is ever asked for. */
        markable?: boolean;
    }

    let { x, y, width = CELL, height = CELL, subject, markable = true }: Props = $props();

    let ask = $derived(!subject && markable);
</script>

<rect
    x={x + 0.6}
    y={y + 0.6}
    width={width - 1.2}
    height={height - 1.2}
    fill="none"
    stroke="#1d4ed8"
    stroke-width="0.9"
    stroke-dasharray={ask ? "1.6 1.1" : undefined}
    pointer-events="none" />
{#if ask}
    <text
        x={x + width / 2}
        y={y + height / 2}
        fill="#1d4ed8"
        font-size="5"
        font-weight="700"
        text-anchor="middle"
        dominant-baseline="central"
        pointer-events="none">?</text>
{/if}
