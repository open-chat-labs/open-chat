<script lang="ts">
    import { bridges, type BridgesDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { CELL, elementCentre } from "../gridSvg";
    import type { PictogramProps } from "../types";

    // Givens only, for the result card.
    let { model }: PictogramProps<BridgesDescription> = $props();

    let islands = $derived(bridges.elements(model).filter((el) => el.kind === "cell"));
</script>

<GridSvg width={model.width} height={model.height} compact>
    <rect x="0" y="0" width={model.width * CELL} height={model.height * CELL} fill="#e6e6e6" />
    {#each islands as el (el.key)}
        {@const c = elementCentre(el)}
        <circle cx={c.cx} cy={c.cy} r="3.6" fill="#ffffff" stroke="#1f1f1f" stroke-width="0.5" />
        <text
            x={c.cx}
            y={c.cy}
            fill="#1f1f1f"
            font-size="4.6"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="central">{el.label}</text>
    {/each}
</GridSvg>
