<script lang="ts">
    import { loopy, type LoopyDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { elementCentre, elementRect, vertex } from "../gridSvg";
    import type { PictogramProps } from "../types";

    // Givens only, for the result card: dots and clues.
    let { model }: PictogramProps<LoopyDescription> = $props();

    const MARGIN = 0.4;

    let elements = $derived(loopy.elements(model));
    let cells = $derived(elements.filter((el) => el.kind === "cell"));
    let dots = $derived.by(() => {
        const out: { x: number; y: number }[] = [];
        for (let y = 0; y <= model.height; y++) {
            for (let x = 0; x <= model.width; x++) out.push({ x, y });
        }
        return out;
    });
</script>

<GridSvg
    width={model.width}
    height={model.height}
    margin={[MARGIN, MARGIN, MARGIN, MARGIN]}
    frame={false}
    compact>
    {#each cells as el (el.key)}
        <rect {...elementRect(el)} fill="#e6e6e6" />
        {#if el.label !== undefined}
            {@const c = elementCentre(el)}
            <text
                x={c.cx}
                y={c.cy}
                fill="#1f1f1f"
                font-size="5.5"
                font-weight="700"
                text-anchor="middle"
                dominant-baseline="central">{el.label}</text>
        {/if}
    {/each}
    {#each dots as d (d.y * (model.width + 1) + d.x)}
        {@const c = vertex(d.x, d.y)}
        <circle cx={c.cx} cy={c.cy} r="0.9" fill="#1f1f1f" />
    {/each}
</GridSvg>
