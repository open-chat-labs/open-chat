<script lang="ts">
    import {
        loopy,
        loopyCellLines,
        loopyDotKey,
        loopyEdgeCount,
        type GameElement,
        type LoopyDescription,
        type LoopyEdge,
    } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { CELL, EDGE, elementCentre, elementRect, highlight, keysOf, vertex } from "../gridSvg";
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
    }: BoardProps<LoopyDescription, LoopyEdge[]> = $props();

    // Dots sit on the grid corners and lines are thick, so the border needs a little room.
    const MARGIN = 0.4;
    // A tap target reaches this far either side of its edge and stops short of the corners so
    // the two edges meeting there never overlap.
    const HIT = 2.4;
    const INSET = 1.6;
    const CROSS = 1.1;

    let elements = $derived(loopy.elements(model));
    let edges = $derived(elements.filter((el) => el.kind === "edge"));
    let cells = $derived(elements.filter((el) => el.kind === "cell"));
    let edgeCount = $derived(loopyEdgeCount(model));
    let cellLines = $derived(loopyCellLines(model, state));
    // lines at a dot with too many, at a dead end, or on a loop that is not the loop
    let badEdges = $derived(keysOf(violations, "dot_degree", "extra_loop"));
    let badClues = $derived(keysOf(violations, "clue_count"));
    let mistakes = $derived(keysOf(violations, "mistake"));
    let dots = $derived.by(() => {
        const out: { x: number; y: number }[] = [];
        for (let y = 0; y <= model.height; y++) {
            for (let x = 0; x <= model.width; x++) out.push({ x, y });
        }
        return out;
    });

    // a clue with exactly its number of lines is greyed out as done
    function clueFill(key: number): string {
        if (greyed) return "#9a9a9a";
        if (badClues.has(key)) return "#e5484d";
        const cell = key - edgeCount;
        return cellLines[cell] === model.clues[cell] ? "#9a9a9a" : "#1f1f1f";
    }

    function hitRect(el: GameElement) {
        const r = elementRect(el);
        return el.w >= el.h
            ? { x: r.x + INSET, y: r.y + EDGE / 2 - HIT, width: r.width - 2 * INSET, height: 2 * HIT }
            : { x: r.x + EDGE / 2 - HIT, y: r.y + INSET, width: 2 * HIT, height: r.height - 2 * INSET };
    }

    function highlightRect(el: GameElement) {
        const r = elementRect(el);
        return { x: r.x - 1, y: r.y - 1, width: r.width + 2, height: r.height + 2 };
    }

    function tap(key: number) {
        if (disabled || key >= edgeCount) return;
        onTap(key);
    }
</script>

<GridSvg
    width={model.width}
    height={model.height}
    margin={[MARGIN, MARGIN, MARGIN, MARGIN]}
    frame={false}
    {disabled}>
    {#each cells as el (el.key)}
        <rect {...elementRect(el)} fill={greyed ? "#e6e6e6" : "#f2f2f2"} />
    {/each}
    {#each edges as el (el.key)}
        {@const mark = marks.get(el.key)}
        {@const c = elementCentre(el)}
        {#if mark === "line"}
            <line
                x1={el.x * CELL}
                y1={el.y * CELL}
                x2={(el.x + el.w) * CELL}
                y2={(el.y + el.h) * CELL}
                stroke={badEdges.has(el.key) ? "#e5484d" : "#1f1f1f"}
                stroke-width="1.6"
                stroke-linecap="round"
                pointer-events="none" />
        {:else}
            <line
                x1={el.x * CELL}
                y1={el.y * CELL}
                x2={(el.x + el.w) * CELL}
                y2={(el.y + el.h) * CELL}
                stroke="#d4d4d4"
                stroke-width="0.3"
                pointer-events="none" />
            {#if mark === "cross"}
                <line
                    x1={c.cx - CROSS}
                    y1={c.cy - CROSS}
                    x2={c.cx + CROSS}
                    y2={c.cy + CROSS}
                    stroke="#8a8a8a"
                    stroke-width="0.5"
                    stroke-linecap="round"
                    pointer-events="none" />
                <line
                    x1={c.cx - CROSS}
                    y1={c.cy + CROSS}
                    x2={c.cx + CROSS}
                    y2={c.cy - CROSS}
                    stroke="#8a8a8a"
                    stroke-width="0.5"
                    stroke-linecap="round"
                    pointer-events="none" />
            {/if}
        {/if}
        {#if focus.has(el.key)}
            {@const hl = highlight(el.key, focus, target)}
            <rect
                {...highlightRect(el)}
                rx="1"
                fill={hl.fill}
                stroke={hl.stroke}
                stroke-width="0.6"
                pointer-events="none" />
        {/if}
        {#if mistakes.has(el.key)}
            <rect
                {...highlightRect(el)}
                rx="1"
                fill="rgba(229,72,77,0.35)"
                stroke="#e5484d"
                stroke-width="0.6"
                pointer-events="none" />
        {/if}
    {/each}
    {#each cells as el (el.key)}
        {@const r = elementRect(el)}
        {#if focus.has(el.key)}
            {@const hl = highlight(el.key, focus, target)}
            <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill={hl.fill}
                stroke={hl.stroke}
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
        {#if el.label !== undefined}
            {@const c = elementCentre(el)}
            <text
                x={c.cx}
                y={c.cy}
                fill={clueFill(el.key)}
                font-size="5.5"
                font-weight="700"
                text-anchor="middle"
                dominant-baseline="central"
                pointer-events="none">{el.label}</text>
        {/if}
    {/each}
    {#each dots as d (d.y * (model.width + 1) + d.x)}
        {@const c = vertex(d.x, d.y)}
        {@const hl = highlight(loopyDotKey(model, d.y * (model.width + 1) + d.x), focus, target)}
        {#if hl.on}
            <circle
                cx={c.cx}
                cy={c.cy}
                r="2.6"
                fill={hl.fill}
                stroke={hl.stroke}
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
        <circle cx={c.cx} cy={c.cy} r="0.9" fill="#1f1f1f" pointer-events="none" />
    {/each}
    {#each edges as el (el.key)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <rect {...hitRect(el)} fill="transparent" role="gridcell" onclick={() => tap(el.key)} />
    {/each}
</GridSvg>
