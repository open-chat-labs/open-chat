<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import ChessPieces from "./ChessPieces.svelte";
    import type { Game } from "./logic";

    export let interactive: boolean;
    export let gameState: Game;

    const dispatch = createEventDispatcher();
    const letters = "ABCDEFGH";
    const numbers = "87654321";
    const board = new Array(8).fill(new Array(8).fill(0));

    let selectedFrom: [number, number] | undefined;
    let selectedTo: [number, number] | undefined;
    let render = Symbol();

    function cellClicked(col: number, row: number): void {
        if (!interactive) return;

        const piece = gameState.getPiece(col, row);

        if (selectedFrom === undefined) {
            if (piece && piece.colour === gameState.next) {
                selectedFrom = [col, row];
                selectedTo = undefined;
                render = Symbol();
                return;
            }
        } else {
            if (piece && piece.colour === gameState.next) {
                selectedFrom = [col, row];
                selectedTo = undefined;
                render = Symbol();
                return;
            }
            if (gameState.validMove(selectedFrom, [col, row])) {
                selectedTo = [col, row];
                gameState.move(selectedFrom, selectedTo);
                dispatch("moveSelected", gameState);
                render = Symbol();
                return;
            }
        }
    }

    function validTarget(col: number, row: number): boolean {
        if (selectedFrom === undefined) return false;
        return gameState.validMove(selectedFrom, [col, row]);
    }

    function selectTo() {
        if (selectedFrom && selectedTo) {
            dispatch("moveSelected", gameState.move(selectedFrom, selectedTo));
        }
    }
</script>

<div class="outer" class:interactive>
    <div class="letters">
        <div class="letter" />
        {#each letters as letter}
            <div class="letter">{letter}</div>
        {/each}
        <div class="letter" />
    </div>

    <div class="wrapper">
        <div class="side">
            {#each numbers as num}
                <div class="num">{num}</div>
            {/each}
        </div>
        {#key render}
            <div class="board">
                {#each board as row, r}
                    {#each row as col, c}
                        <div
                            class:selectedFrom={selectedTo === undefined &&
                                selectedFrom !== undefined &&
                                selectedFrom[0] === c &&
                                selectedFrom[1] === r}
                            class:selectedTo={selectedTo !== undefined &&
                                selectedTo[0] === c &&
                                selectedTo[1] === r}
                            class="cell"
                            on:click={() => cellClicked(c, r)}
                            class:validTarget={selectedTo === undefined && validTarget(c, r)}
                            class:black={(r + c) % 2 === 0}>
                            <ChessPieces piece={gameState.getPiece(c, r)} />
                        </div>
                    {/each}
                {/each}
            </div>
        {/key}
        <div class="side">
            {#each numbers as num}
                <div class="num">{num}</div>
            {/each}
        </div>
    </div>
    <div class="letters">
        <div class="letter" />
        {#each letters as letter}
            <div class="letter">{letter}</div>
        {/each}
        <div class="letter" />
    </div>
</div>

<style type="text/scss">
    $size: 40px;

    .outer {
        max-width: 400px;
    }

    .wrapper {
        display: flex;

        .side {
            flex: 0 0 $size;
        }
    }

    .interactive .cell:not(:empty) {
        cursor: pointer;

        &:hover::after {
            content: "";
            width: $size;
            height: $size;
            position: absolute;
            top: 0;
            left: 0;
            background-color: rgba(0, 0, 0, 0.2);
        }
    }

    .board {
        flex: auto;
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(8, 1fr);

        .cell {
            background-color: #777;
            color: white;
            position: relative;

            &.black {
                background-color: white;
                color: black;
            }

            &.selectedFrom::after,
            &.validTarget::after,
            &.selectedTo::after {
                content: "";
                width: $size;
                height: $size;
                position: absolute;
                top: 0;
                left: 0;
            }

            &.validTarget::after {
                background-color: #00ff0050;
            }

            &.selectedFrom::after {
                background-color: #00ff00aa;
            }

            &.selectedTo::after {
                background-color: #ff000050;
            }
        }
    }

    .letters {
        display: flex;
        justify-content: space-evenly;
    }

    .num,
    .letter,
    .cell {
        width: $size;
        height: $size;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .piece {
        background-image: url("../assets/chess.svg");
        background-repeat: no-repeat;
        width: 24px;
        height: 24px;

        &.white {
            background-position-y: 40px;
        }
    }
</style>
