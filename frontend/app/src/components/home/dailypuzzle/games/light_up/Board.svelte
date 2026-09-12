<script lang="ts">
    import { lightUp, type LightUpCell, type LightUpDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { CELL, elementCentre, elementRect, highlight, keysOf } from "../gridSvg";
    import type { BoardProps } from "../types";

    let {
        model,
        marks,
        lit,
        violations,
        focus,
        target,
        onTap,
        greyed = false,
        disabled = false,
    }: BoardProps<LightUpDescription, LightUpCell[]> = $props();

    let elements = $derived(lightUp.elements(model));
    // a bulb that sees another or sits on a black cell
    let clashes = $derived(keysOf(violations, "clash"));
    let over = $derived(keysOf(violations, "over"));
    let under = $derived(keysOf(violations, "under"));
    let mistakes = $derived(keysOf(violations, "mistake"));

    function whiteFill(key: number): string {
        if (greyed) return "#e6e6e6";
        return lit.has(key) ? "#fff1a3" : "#ececec";
    }

    // a clue whose bulb count is exactly right is greyed out as done
    function clueFill(key: number): string {
        if (over.has(key)) return "#ff6b6b";
        if (!under.has(key)) return "#9a9a9a";
        return "#ffffff";
    }

    function tap(key: number) {
        if (disabled || model.cells[key].kind !== "white") return;
        onTap(key);
    }
</script>

<GridSvg width={model.width} height={model.height} {disabled}>
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        {@const c = elementCentre(el)}
        {@const black = model.cells[el.key].kind === "black"}
        {#if black}
            <rect {...r} fill="#1f1f1f" />
            {#if el.label !== undefined}
                <text
                    x={c.cx}
                    y={c.cy}
                    fill={clueFill(el.key)}
                    font-size="6.5"
                    font-weight="700"
                    text-anchor="middle"
                    dominant-baseline="central">{el.label}</text>
            {/if}
        {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <rect
                {...r}
                fill={whiteFill(el.key)}
                stroke="#bdbdbd"
                stroke-width="0.3"
                role="gridcell"
                onclick={() => tap(el.key)} />
            {#if marks.get(el.key) === "bulb"}
                <circle
                    cx={c.cx}
                    cy={c.cy}
                    r="3.2"
                    fill={clashes.has(el.key) ? "#e5484d" : "#f5b700"}
                    stroke={clashes.has(el.key) ? "#a3232a" : "#a06c00"}
                    stroke-width="0.5"
                    pointer-events="none" />
            {:else if marks.get(el.key) === "dot"}
                <circle cx={c.cx} cy={c.cy} r="1" fill="#7a7a7a" pointer-events="none" />
            {/if}
        {/if}
        {#if focus.has(el.key)}
            {@const hl = highlight(el.key, focus, target)}
            <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill={black ? "none" : hl.fill}
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
</GridSvg>
