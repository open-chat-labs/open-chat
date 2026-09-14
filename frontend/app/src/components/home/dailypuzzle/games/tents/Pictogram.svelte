<script lang="ts">
    import { tents, type TentsDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { elementCentre, elementRect, outside } from "../gridSvg";
    import type { PictogramProps } from "../types";

    // Givens only (trees and counts), for the result card.
    let { model }: PictogramProps<TentsDescription> = $props();

    let elements = $derived(tents.elements(model));
</script>

<GridSvg width={model.width} height={model.height} margin={[0, 1, 1, 0]} compact>
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        <rect {...r} fill="#e6e6e6" stroke="#bdbdbd" stroke-width="0.3" />
        {#if model.trees[el.key]}
            {@const c = elementCentre(el)}
            <rect x={c.cx - 0.8} y={c.cy + 1.4} width="1.6" height="2.6" fill="#6b4423" />
            <polygon
                points="{c.cx},{c.cy - 3.8} {c.cx - 3.2},{c.cy + 1.8} {c.cx + 3.2},{c.cy + 1.8}"
                fill="#2e7d32" />
        {/if}
    {/each}
    {#each model.rowCounts as count, y (y)}
        {@const p = outside("right", y, model.width, model.height)}
        <text
            x={p.cx}
            y={p.cy}
            fill="#1f1f1f"
            font-size="5.5"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="central">{count}</text>
    {/each}
    {#each model.columnCounts as count, x (x)}
        {@const p = outside("bottom", x, model.width, model.height)}
        <text
            x={p.cx}
            y={p.cy}
            fill="#1f1f1f"
            font-size="5.5"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="central">{count}</text>
    {/each}
</GridSvg>
