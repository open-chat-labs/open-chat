<script lang="ts">
    import { unruly, type UnrulyCell, type UnrulyDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import HintOutline from "../HintOutline.svelte";
    import { CELL, elementCentre, elementRect, keysOf } from "../gridSvg";
    import { discPairIndex, discPairs } from "./colours";
    import type { BoardProps } from "../types";

    let {
        board,
        violations,
        focus,
        target,
        onTap,
        greyed = false,
        disabled = false,
    }: BoardProps<UnrulyDescription, UnrulyCell[]> = $props();
    let model = $derived(board.model);
    let marks = $derived(board.marks);

    // The two values are flat discs in the player's chosen pair (colours.ts).
    let pair = $derived(discPairs[$discPairIndex]);
    const RED = "#e5484d";
    const DISC = 3.4;

    let elements = $derived(unruly.elements(model));
    // The three cells of a run that repeats: those discs go red and get the red ring too, so
    // the mistake shows for players who can't tell the red from the disc colour.
    let runs = $derived(keysOf(violations, "run"));
    // Every cell of the value a row or column has too many of: those cells get a red ring.
    let overfull = $derived(keysOf(violations, "row_count", "column_count"));
    let mistakes = $derived(keysOf(violations, "mistake"));

    function discFill(key: number, mark: string): string {
        if (runs.has(key)) return RED;
        if (greyed) return mark === "given_b" || mark === "b" ? "#9a9a9a" : "#c4c4c4";
        return mark === "given_b" || mark === "b" ? pair.b : pair.a;
    }

    function tap(key: number) {
        if (disabled || model.givens[key] !== 0) return;
        onTap(key);
    }
</script>

<GridSvg width={model.width} height={model.height} {disabled}>
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <rect
            {...r}
            fill={greyed ? "#e6e6e6" : "#ececec"}
            stroke="#bdbdbd"
            stroke-width="0.3"
            role="gridcell"
            onclick={() => tap(el.key)} />
    {/each}
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        {@const c = elementCentre(el)}
        {@const mark = marks.get(el.key)}
        {#if mark !== undefined}
            <!-- givens and the player's discs look the same; a given just ignores taps -->
            <circle
                cx={c.cx}
                cy={c.cy}
                r={DISC}
                fill={discFill(el.key, mark)}
                stroke="#1f1f1f"
                stroke-width="0.4"
                pointer-events="none" />
        {/if}
        {#if overfull.has(el.key) || runs.has(el.key)}
            <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill="none"
                stroke={RED}
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
        {#if focus.has(el.key)}
            <!-- a given takes no mark, so it is never asked for -->
            <HintOutline
                x={r.x}
                y={r.y}
                subject={target.has(el.key)}
                markable={model.givens[el.key] === 0} />
        {/if}
        {#if mistakes.has(el.key)}
            <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill="rgba(229,72,77,0.35)"
                stroke={RED}
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
    {/each}
</GridSvg>
