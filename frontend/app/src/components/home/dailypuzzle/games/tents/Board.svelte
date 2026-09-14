<script lang="ts">
    import {
        tents,
        tentsColumnKey,
        tentsRowKey,
        type TentsCell,
        type TentsDescription,
    } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { CELL, elementCentre, elementRect, highlight, keysOf, outside } from "../gridSvg";
    import type { BoardProps } from "../types";

    let {
        model,
        marks,
        violations,
        focus,
        target,
        onTap,
        greyed = false,
        disabled = false,
    }: BoardProps<TentsDescription, TentsCell[]> = $props();

    let elements = $derived(tents.elements(model));
    // a tent that touches another or sits on a tree
    let clashes = $derived(keysOf(violations, "clash"));
    // a tent with no tree beside it
    let lonely = $derived(keysOf(violations, "lonely"));
    // trees and tents in a group that cannot pair up one-to-one
    let unmatched = $derived(keysOf(violations, "unmatched"));
    let over = $derived(keysOf(violations, "over"));
    let under = $derived(keysOf(violations, "under"));
    let mistakes = $derived(keysOf(violations, "mistake"));

    let rowTents = $derived.by(() => {
        const out = new Array<number>(model.height).fill(0);
        for (const [key, mark] of marks) {
            if (mark === "tent") out[Math.floor(key / model.width)]++;
        }
        return out;
    });
    let columnTents = $derived.by(() => {
        const out = new Array<number>(model.width).fill(0);
        for (const [key, mark] of marks) {
            if (mark === "tent") out[key % model.width]++;
        }
        return out;
    });

    function cellFill(): string {
        return greyed ? "#e6e6e6" : "#ececec";
    }

    // a count with exactly its tents is greyed out as done; over (or short once the line is
    // fully marked) is red
    function countFill(key: number, satisfied: boolean): string {
        if (over.has(key) || under.has(key)) return "#e5484d";
        if (satisfied) return "#9a9a9a";
        return "#1f1f1f";
    }

    function tentFill(key: number): { fill: string; stroke: string } {
        if (clashes.has(key)) return { fill: "#e5484d", stroke: "#a3232a" };
        if (lonely.has(key) || unmatched.has(key)) return { fill: "#f59e0b", stroke: "#a3232a" };
        return { fill: "#f5b700", stroke: "#a06c00" };
    }

    function tap(key: number) {
        if (disabled || model.trees[key]) return;
        onTap(key);
    }
</script>

<GridSvg width={model.width} height={model.height} margin={[0, 1, 1, 0]} {disabled}>
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        {@const c = elementCentre(el)}
        {@const tree = model.trees[el.key]}
        {#if tree}
            <rect {...r} fill={cellFill()} stroke="#bdbdbd" stroke-width="0.3" />
            <!-- tree: canopy on a trunk -->
            <rect
                x={c.cx - 0.8}
                y={c.cy + 1.4}
                width="1.6"
                height="2.6"
                fill={greyed ? "#9a9a9a" : "#6b4423"}
                pointer-events="none" />
            <polygon
                points="{c.cx},{c.cy - 3.8} {c.cx - 3.2},{c.cy + 1.8} {c.cx + 3.2},{c.cy + 1.8}"
                fill={greyed ? "#b5b5b5" : "#2e7d32"}
                stroke={unmatched.has(el.key) ? "#e5484d" : "none"}
                stroke-width="0.6"
                stroke-linejoin="round"
                pointer-events="none" />
        {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <rect
                {...r}
                fill={cellFill()}
                stroke="#bdbdbd"
                stroke-width="0.3"
                role="gridcell"
                onclick={() => tap(el.key)} />
            {#if marks.get(el.key) === "tent"}
                {@const t = tentFill(el.key)}
                <polygon
                    points="{c.cx},{c.cy - 3.4} {c.cx - 3.8},{c.cy + 3} {c.cx + 3.8},{c.cy + 3}"
                    fill={t.fill}
                    stroke={t.stroke}
                    stroke-width="0.5"
                    stroke-linejoin="round"
                    pointer-events="none" />
                <polygon
                    points="{c.cx},{c.cy + 0.2} {c.cx - 1.2},{c.cy + 3} {c.cx + 1.2},{c.cy + 3}"
                    fill={t.stroke}
                    pointer-events="none" />
            {:else if marks.get(el.key) === "grass"}
                <line
                    x1={c.cx - 1.6}
                    y1={c.cy}
                    x2={c.cx + 1.6}
                    y2={c.cy}
                    stroke="#7a7a7a"
                    stroke-width="0.9"
                    stroke-linecap="round"
                    pointer-events="none" />
            {/if}
        {/if}
        {#if focus.has(el.key)}
            {@const hl = highlight(el.key, focus, target)}
            <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill={tree ? "none" : hl.fill}
                stroke={hl.stroke}
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
        {#if mistakes.has(el.key)}
            <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill="rgba(229,72,77,0.35)"
                stroke="#e5484d"
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
    {/each}
    {#each model.rowCounts as count, y (y)}
        {@const p = outside("right", y, model.width, model.height)}
        <text
            x={p.cx}
            y={p.cy}
            fill={greyed ? "#9a9a9a" : countFill(tentsRowKey(model, y), rowTents[y] === count)}
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
            fill={greyed ? "#9a9a9a" : countFill(tentsColumnKey(model, x), columnTents[x] === count)}
            font-size="5.5"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="central">{count}</text>
    {/each}
</GridSvg>
