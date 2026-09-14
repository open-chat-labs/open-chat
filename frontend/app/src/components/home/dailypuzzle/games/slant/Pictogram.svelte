<script lang="ts">
    import { slant, type SlantDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { elementRect, vertex } from "../gridSvg";
    import type { PictogramProps } from "../types";

    // Givens only, for the result card.
    let { model }: PictogramProps<SlantDescription> = $props();

    // border clue circles (r 2.4 + stroke) spill past the grid; same margin as Board
    const MARGIN = 0.5;

    let elements = $derived(slant.elements(model));
    let cells = $derived(elements.filter((el) => el.kind === "cell"));
    let clues = $derived(elements.filter((el) => el.kind === "vertex" && el.label !== undefined));
</script>

<GridSvg
    width={model.width}
    height={model.height}
    margin={[MARGIN, MARGIN, MARGIN, MARGIN]}
    compact>
    {#each cells as el (el.key)}
        <rect {...elementRect(el)} fill="#e6e6e6" stroke="#bdbdbd" stroke-width="0.3" />
    {/each}
    {#each clues as el (el.key)}
        {@const c = vertex(el.x, el.y)}
        <circle cx={c.cx} cy={c.cy} r="2.4" fill="#ffffff" stroke="#1f1f1f" stroke-width="0.4" />
        <text
            x={c.cx}
            y={c.cy}
            fill="#1f1f1f"
            font-size="3.4"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="central">{el.label}</text>
    {/each}
</GridSvg>
