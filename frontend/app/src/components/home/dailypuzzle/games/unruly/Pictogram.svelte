<script lang="ts">
    import { unruly, type UnrulyDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { elementCentre, elementRect } from "../gridSvg";
    import type { PictogramProps } from "../types";

    // Givens only, for the result card.
    let { model }: PictogramProps<UnrulyDescription> = $props();

    const ORANGE = "#f08c00";
    const PURPLE = "#6b21a8";
    const DISC = 3.4;

    let elements = $derived(unruly.elements(model));
</script>

<GridSvg width={model.width} height={model.height} compact>
    {#each elements as el (el.key)}
        <rect {...elementRect(el)} fill="#e6e6e6" stroke="#bdbdbd" stroke-width="0.3" />
    {/each}
    {#each elements as el (el.key)}
        {@const c = elementCentre(el)}
        {@const given = model.givens[el.key]}
        {#if given !== 0}
            <circle
                cx={c.cx}
                cy={c.cy}
                r={DISC}
                fill={given === 2 ? PURPLE : ORANGE}
                stroke="#1f1f1f"
                stroke-width="0.8" />
        {/if}
    {/each}
</GridSvg>
