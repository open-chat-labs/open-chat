<!-- A daily puzzle result card's grid, from the layout the card carries, drawn by its game's own
     pictogram (the givens only), for the new trees' result card (DailyResultMessage's `preview`).
     Nothing for a game this build doesn't know, or a layout it can't read. -->
<script lang="ts">
    import type { DailyResultContent } from "@client";
    import { resultCardBoard } from "./registry";

    let { content }: { content: Pick<DailyResultContent, "gameId" | "layout"> } = $props();

    const board = $derived(resultCardBoard(content));
</script>

{#if board !== undefined}
    <board.Pictogram {board} />
{/if}
