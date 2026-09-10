<script lang="ts">
    import { unruly, type UnrulyCell, type UnrulyDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { CELL, elementCentre, elementRect, highlight, keysOf } from "../gridSvg";
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
    }: BoardProps<UnrulyDescription, UnrulyCell[]> = $props();

    // The two values are flat discs. Orange is much the lighter of the two, so they stay apart
    // in greyscale and for anyone who reads the hues differently, and neither is near the
    // violation red or the hint blue.
    const ORANGE = "#f08c00";
    const PURPLE = "#6b21a8";
    const RED = "#e5484d";
    const DISC = 3.4;

    let elements = $derived(unruly.elements(model));
    // The three cells of a run that repeats: those discs go red.
    let runs = $derived(keysOf(violations, "run"));
    // Every cell of the value a row or column has too many of: those cells get a red ring.
    let overfull = $derived(keysOf(violations, "row_count", "column_count"));
    let mistakes = $derived(keysOf(violations, "mistake"));

    function discFill(key: number, mark: string): string {
        if (runs.has(key)) return RED;
        if (greyed) return mark === "given_b" || mark === "b" ? "#9a9a9a" : "#c4c4c4";
        return mark === "given_b" || mark === "b" ? PURPLE : ORANGE;
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
            <!-- a given is ringed, so it is obvious which cells the player may still change -->
            <circle
                cx={c.cx}
                cy={c.cy}
                r={DISC}
                fill={discFill(el.key, mark)}
                stroke={mark.startsWith("given") ? "#1f1f1f" : "none"}
                stroke-width="0.8"
                pointer-events="none" />
        {/if}
        {#if overfull.has(el.key)}
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
