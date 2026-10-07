<script lang="ts">
    import { chatRooms, type ChatRoomsCell, type ChatRoomsDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import HintOutline from "../HintOutline.svelte";
    import NoMark from "../NoMark.svelte";
    import { CELL, elementCentre, elementRect, keysOf } from "../gridSvg";
    import type { BoardProps } from "../types";
    import { roomFill, walls } from "./rooms";

    let {
        board,
        violations,
        focus,
        target,
        onTap,
        greyed = false,
        disabled = false,
    }: BoardProps<ChatRoomsDescription, ChatRoomsCell[]> = $props();
    let model = $derived(board.model);
    let marks = $derived(board.marks);
    let lit = $derived(board.lit);

    const LOGO = "/assets/oc_logo_no_bg.svg";
    const LOGO_SIZE = 5.5;
    // The logo's hole: radius 97.2 of its 350 box. Filled dark, it reads better on the pale room
    // colours than the cell showing through.
    const HOLE = (LOGO_SIZE * 97.2) / 350;

    let elements = $derived(chatRooms.elements(model));
    let roomWalls = $derived(walls(model.size, model.rooms));
    // a logo sharing a row, column or room with another, or touching one
    let clashes = $derived(keysOf(violations, "clash"));
    let mistakes = $derived(keysOf(violations, "mistake"));

    function tap(key: number) {
        if (disabled) return;
        onTap(key);
    }
</script>

<GridSvg width={model.size} height={model.size} {disabled}>
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <rect
            {...r}
            fill={roomFill(model.rooms[el.key], greyed)}
            stroke="rgba(0,0,0,0.18)"
            stroke-width="0.2"
            role="gridcell"
            onclick={() => tap(el.key)} />
    {/each}
    {#each roomWalls as w}
        <line {...w} stroke="#1f1f1f" stroke-width="0.55" stroke-linecap="square" pointer-events="none" />
    {/each}
    {#each elements as el (el.key)}
        {@const r = elementRect(el)}
        {@const c = elementCentre(el)}
        {#if marks.get(el.key) === "logo"}
            {#if clashes.has(el.key)}
                <circle cx={c.cx} cy={c.cy} r={LOGO_SIZE / 2 + 0.8} fill="#e5484d" pointer-events="none" />
            {/if}
            <circle cx={c.cx} cy={c.cy} r={HOLE} fill="#161616" pointer-events="none" />
            <image
                href={LOGO}
                x={c.cx - LOGO_SIZE / 2}
                y={c.cy - LOGO_SIZE / 2}
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                pointer-events="none" />
        {:else if marks.get(el.key) === "cross"}
            <NoMark cx={c.cx} cy={c.cy} colour="#2b2b2b" size={0.8} />
        {:else if lit.has(el.key)}
            <!-- ruled out by a placed CHAT: crossed for the player, fainter than their own -->
            <NoMark cx={c.cx} cy={c.cy} colour="rgba(43, 43, 43, 0.45)" size={0.8} />
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
</GridSvg>
