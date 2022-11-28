<script lang="ts">
    import { validate_each_argument } from "svelte/internal";
    import ChessPieces from "./ChessPieces.svelte";
    import { fromCoords, initialGameState, Piece } from "./logic";

    export let interactive: boolean;
    const letters = "ABCDEFGH";
    const numbers = "87654321";
    const board = new Array(8).fill(new Array(8).fill(0));

    let game = initialGameState;
    let selectedFrom: [number, number] | undefined;
    let selectedTo: [number, number] | undefined;

    /**
     *  TODO - if we click on one of our own pieces we reset selectedFrom
     * if we click on any other slot (valid) && we already have a selectedFrom then we set selectedTo
     */
    function pieceClicked(col: number, row: number): void {
        if (!interactive) return;
        selectedFrom = [col, row];
    }

    function cellClicked(col: number, row: number): void {
        if (!interactive) return;
        selectedFrom = [col, row];
    }

    function validTarget(col: number, row: number): boolean {
        if (selectedFrom === undefined) return false;
        return game.validMove(selectedFrom, [col, row]);
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
        {#key selectedFrom}
            <div class="board">
                {#each board as row, r}
                    {#each row as col, c}
                        <div
                            class:selected={selectedFrom !== undefined &&
                                selectedFrom[0] === c &&
                                selectedFrom[1] === r}
                            on:click={() => cellClicked(c, r)}
                            class="cell"
                            class:validTarget={validTarget(c, r)}
                            class:black={(r + c) % 2 === 0}>
                            <ChessPieces
                                on:click={() => pieceClicked(c, r)}
                                piece={game.getPiece(c, r)} />
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

            &.selected::after {
                content: "";
                width: $size;
                height: $size;
                position: absolute;
                top: 0;
                left: 0;
                background-color: #00ff00aa;
            }

            &.validTarget::after {
                content: "";
                width: $size;
                height: $size;
                position: absolute;
                top: 0;
                left: 0;
                background-color: #00ff0050;
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
