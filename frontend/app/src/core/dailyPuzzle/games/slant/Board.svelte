<script lang="ts">
    import { slant, slantVertexLines, type SlantCell, type SlantDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import HintOutline from "../HintOutline.svelte";
    import { CELL, elementRect, keysOf, vertex } from "../gridSvg";
    import type { BoardProps } from "../types";

    let {
        board,
        violations,
        focus,
        target,
        onTap,
        greyed = false,
        disabled = false,
    }: BoardProps<SlantDescription, SlantCell[]> = $props();
    let model = $derived(board.model);
    let state = $derived(board.state);
    let marks = $derived(board.marks);

    // Clue circles sit on the grid corners, so the outer ones need a little room past the frame.
    const CLUE_R = 2.4;
    // border clues and their focus ring (CLUE_R + 1, stroke 0.9) spill past the grid; keep the
    // margin clear of both
    const MARGIN = 0.5;

    let elements = $derived(slant.elements(model));
    let cells = $derived(elements.filter((el) => el.kind === "cell"));
    let vertices = $derived(elements.filter((el) => el.kind === "vertex"));
    let cellCount = $derived(model.width * model.height);
    let loops = $derived(keysOf(violations, "loop"));
    let badClues = $derived(keysOf(violations, "vertex_count"));
    let mistakes = $derived(keysOf(violations, "mistake"));
    let lines = $derived(slantVertexLines(model, state));

    // always opaque: the circles sit on the frame and must cover it in every state. A clue
    // with exactly its number of lines is greyed out as done.
    function clueFill(key: number): string {
        if (greyed) return "#e6e6e6";
        if (badClues.has(key)) return "#e5484d";
        const v = key - cellCount;
        return lines[v] === model.clues[v] ? "#c9c9c9" : "#ffffff";
    }

    function tap(key: number) {
        if (disabled || key >= cellCount) return;
        onTap(key);
    }
</script>

<GridSvg
    width={model.width}
    height={model.height}
    margin={[MARGIN, MARGIN, MARGIN, MARGIN]}
    {disabled}>
    {#each cells as el (el.key)}
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
    {#each cells as el (el.key)}
        {@const r = elementRect(el)}
        {@const mark = marks.get(el.key)}
        {#if mark === "backslash" || mark === "slash"}
            <line
                x1={r.x}
                y1={mark === "backslash" ? r.y : r.y + r.height}
                x2={r.x + r.width}
                y2={mark === "backslash" ? r.y + r.height : r.y}
                stroke={loops.has(el.key) ? "#e5484d" : "#1f1f1f"}
                stroke-width="1.4"
                stroke-linecap="round"
                pointer-events="none" />
        {/if}
        {#if focus.has(el.key)}
            <HintOutline x={r.x} y={r.y} subject={target.has(el.key)} />
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
    {#each vertices as el (el.key)}
        {@const c = vertex(el.x, el.y)}
        {#if el.label !== undefined}
            <circle
                cx={c.cx}
                cy={c.cy}
                r={CLUE_R}
                fill={clueFill(el.key)}
                stroke="#1f1f1f"
                stroke-width="0.4"
                pointer-events="none" />
            <text
                x={c.cx}
                y={c.cy}
                fill={badClues.has(el.key) ? "#ffffff" : "#1f1f1f"}
                font-size="3.4"
                font-weight="700"
                text-anchor="middle"
                dominant-baseline="central"
                pointer-events="none">{el.label}</text>
        {/if}
        {#if focus.has(el.key)}
            <!-- A corner takes no mark, so it is never asked for: always HintOutline's solid
                 look, a ring round the clue circle (or the bare corner) -->
            <circle
                cx={c.cx}
                cy={c.cy}
                r={CLUE_R + 1}
                fill="none"
                stroke="#1d4ed8"
                stroke-width="0.9"
                pointer-events="none" />
        {/if}
    {/each}
</GridSvg>
