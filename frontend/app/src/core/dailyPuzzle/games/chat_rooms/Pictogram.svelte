<script lang="ts">
    import { chatRooms, type ChatRoomsDescription } from "@client";
    import GridSvg from "../GridSvg.svelte";
    import { elementRect } from "../gridSvg";
    import type { PictogramProps } from "../types";
    import { roomFill, walls } from "./rooms";

    // The rooms only, for the result card.
    let { board }: PictogramProps<ChatRoomsDescription> = $props();
    let model = $derived(board.model);

    let elements = $derived(chatRooms.elements(model));
    let roomWalls = $derived(walls(model.size, model.rooms));
</script>

<GridSvg width={model.size} height={model.size} compact>
    {#each elements as el (el.key)}
        <rect {...elementRect(el)} fill={roomFill(model.rooms[el.key])} />
    {/each}
    {#each roomWalls as w}
        <line {...w} stroke="#1f1f1f" stroke-width="0.55" stroke-linecap="square" />
    {/each}
</GridSvg>
