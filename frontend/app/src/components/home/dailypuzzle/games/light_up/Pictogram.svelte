<script lang="ts">
    import { lightUp, type LightUpDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { elementCentre, elementRect } from "../gridSvg";
    import type { PictogramProps } from "../types";

    // Givens only, for the result card.
    let { model }: PictogramProps<LightUpDescription> = $props();

    let elements = $derived(lightUp.elements(model));
</script>

<GridSvg width={model.width} height={model.height} compact>
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        {#if model.cells[el.key].kind === "black"}
            <rect {...r} fill="#1f1f1f" />
            {#if el.label !== undefined}
                {@const c = elementCentre(el)}
                <text
                    x={c.cx}
                    y={c.cy}
                    fill="#ffffff"
                    font-size="6.5"
                    font-weight="700"
                    text-anchor="middle"
                    dominant-baseline="central">{el.label}</text>
            {/if}
        {:else}
            <rect {...r} fill="#e6e6e6" stroke="#bdbdbd" stroke-width="0.3" />
        {/if}
    {/each}
</GridSvg>
