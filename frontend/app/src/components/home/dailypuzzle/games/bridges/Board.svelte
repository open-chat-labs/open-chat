<script lang="ts">
    import {
        bridges,
        bridgesMistakeElements,
        bridgesIslandTotals,
        type BridgesDescription,
        type BridgesState,
        bridgesHitShapes,
        type BridgesHitShape,
    } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import NoMark from "../NoMark.svelte";
    import { CELL, elementCentre, highlight, hitQuarter, keysOf } from "../gridSvg";
    import type { BoardProps } from "../types";

    let {
        model,
        state,
        marks,
        violations,
        focus,
        target,
        onTap,
        greyed = false,
        disabled = false,
    }: BoardProps<BridgesDescription, BridgesState> = $props();

    const ISLAND_R = 3.6;
    // half the distance between the two lines of a double bridge
    const GAP = 1.2;

    let elements = $derived(bridges.elements(model));
    let islands = $derived(elements.filter((el) => el.kind === "cell"));
    // edge rects cover the water between two islands; even keys run right, odd keys run down
    let edges = $derived(elements.filter((el) => el.kind === "edge"));
    let totals = $derived(bridgesIslandTotals(model, state));
    let crossing = $derived(keysOf(violations, "crossing"));
    let over = $derived(keysOf(violations, "over"));
    let under = $derived(keysOf(violations, "under"));
    let disconnected = $derived(keysOf(violations, "disconnected"));
    // cell indices the server flagged
    let mistakes = $derived(keysOf(violations, "mistake"));

    // Tap targets, one per water cell per edge. A cell two edges share is split along its
    // diagonals so each edge keeps a target of its own (#9372); the polygon is in SVG units.
    let hitShapes = $derived(bridgesHitShapes(model));
    function hitPoints(shape: BridgesHitShape): string {
        return hitQuarter(cellOrigin(shape.cell), shape.part)
            .map(([x, y]) => `${x},${y}`)
            .join(" ");
    }

    function cellOrigin(index: number): { x: number; y: number } {
        return { x: (index % model.width) * CELL, y: Math.floor(index / model.width) * CELL };
    }

    // an island with exactly its number of bridges is greyed out as done
    function islandFill(key: number): string {
        if (greyed) return "#e6e6e6";
        if (over.has(key) || under.has(key)) return "#ff6b6b";
        return totals.get(key) === model.cells[key] ? "#c9c9c9" : "#ffffff";
    }

    function tap(key: number) {
        if (disabled) return;
        onTap(key);
    }
</script>

<GridSvg width={model.width} height={model.height} {disabled}>
    <rect
        x="0"
        y="0"
        width={model.width * CELL}
        height={model.height * CELL}
        fill={greyed ? "#e6e6e6" : "#ececec"}
    />
    {#each hitShapes as shape (`${shape.key}:${shape.cell}:${shape.part}`)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <polygon
            points={hitPoints(shape)}
            fill="transparent"
            role="gridcell"
            onclick={() => tap(shape.key)}
        />
    {/each}
    {#each edges as el (el.key)}
        {@const mark = marks.get(el.key)}
        {@const c = elementCentre(el)}
        {@const horizontal = el.key % 2 === 0}
        {@const stroke = crossing.has(el.key) ? "#e5484d" : "#1f1f1f"}
        {#if mark === "one" || mark === "two"}
            {#each mark === "one" ? [0] : [-GAP, GAP] as offset (offset)}
                <line
                    x1={horizontal ? (el.x - 0.5) * CELL : c.cx + offset}
                    y1={horizontal ? c.cy + offset : (el.y - 0.5) * CELL}
                    x2={horizontal ? (el.x + el.w + 0.5) * CELL : c.cx + offset}
                    y2={horizontal ? c.cy + offset : (el.y + el.h + 0.5) * CELL}
                    {stroke}
                    stroke-width="1"
                    pointer-events="none"
                />
            {/each}
        {:else if mark === "none"}
            <NoMark cx={c.cx} cy={c.cy} />
        {/if}
    {/each}
    {#each islands as el (el.key)}
        {@const c = elementCentre(el)}
        <circle
            cx={c.cx}
            cy={c.cy}
            r={ISLAND_R}
            fill={islandFill(el.key)}
            stroke={disconnected.has(el.key) ? "#e5484d" : "#1f1f1f"}
            stroke-width={disconnected.has(el.key) ? 0.9 : 0.5}
            pointer-events="none"
        />
        <text
            x={c.cx}
            y={c.cy}
            fill="#1f1f1f"
            font-size="4.6"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="central"
            pointer-events="none">{el.label}</text
        >
    {/each}
    {#each [...focus] as index (index)}
        {@const o = cellOrigin(index)}
        {@const hl = highlight(index, focus, target)}
        {#if model.cells[index] !== 0}
            <circle
                cx={o.x + CELL / 2}
                cy={o.y + CELL / 2}
                r={ISLAND_R + 0.9}
                fill="none"
                stroke={hl.stroke}
                stroke-width="0.8"
                pointer-events="none"
            />
        {:else}
            <rect
                x={o.x + 0.5}
                y={o.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill={hl.fill}
                stroke={hl.stroke}
                stroke-width="0.8"
                pointer-events="none"
            />
        {/if}
    {/each}
    {#each bridgesMistakeElements(elements, mistakes) as el (el.key)}
        <rect
            x={el.x * CELL + 0.5}
            y={el.y * CELL + 0.5}
            width={el.w * CELL - 1}
            height={el.h * CELL - 1}
            fill="rgba(229,72,77,0.35)"
            stroke="#e5484d"
            stroke-width="0.8"
            pointer-events="none"
        />
    {/each}
</GridSvg>
