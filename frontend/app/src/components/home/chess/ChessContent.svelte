<script lang="ts">
    import type { CustomContent } from "openchat-client";
    import ChessBoard from "./ChessBoard.svelte";
    import { Game } from "./logic";

    export let content: CustomContent;

    let gameState: Game | undefined;

    // TODO - we need to detect whether we have reached a stalemate etc to decide
    // whether more replies are allowed

    $: gameState = new Game(content.payload);
</script>

{#if gameState !== undefined}
    <ChessBoard {gameState} interactive={false} />
{/if}
