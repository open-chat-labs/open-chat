<script lang="ts">
    import type { CustomContent } from "openchat-client";
    import ChessBoard from "./ChessBoard.svelte";
    import { Game } from "./logic";

    export let content: CustomContent;

    let gameState: Game | undefined;

    $: gameState = new Game(content.payload);
</script>

{#if gameState !== undefined}
    <ChessBoard {gameState} interactive={false} />
{/if}
