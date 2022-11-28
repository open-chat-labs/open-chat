<script lang="ts">
    import ChessPieces from "./ChessPieces.svelte";
    import { fromCoords, initialState, Piece } from "./logic";

    export let interactive: boolean;
    const letters = "ABCDEFGH";
    const numbers = "87654321";
    const board = new Array(8).fill(new Array(8).fill(0));

    let state = initialState;
    let selectedCoords: [number, number] | undefined;

    function pieceClicked(col: number, row: number): void {
        if (!interactive) return;
        console.log("piece clicked");
        selectedCoords = [col, row];
    }

    function cellClicked(col: number, row: number): void {
        if (!interactive) return;
        selectedCoords = [col, row];
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
        <div class="board">
            {#each board as row, r}
                {#each row as col, c}
                    <div
                        class:selected={selectedCoords !== undefined &&
                            selectedCoords[0] === c &&
                            selectedCoords[1] === r}
                        on:click={() => cellClicked(c, r)}
                        class="cell"
                        class:black={(r + c) % 2 === 0}>
                        {#if state[fromCoords(c, r)]}
                            <ChessPieces
                                on:click={() => pieceClicked(c, r)}
                                type={state[fromCoords(c, r)].type}
                                color={state[fromCoords(c, r)].colour} />
                        {/if}
                    </div>
                {/each}
            {/each}
        </div>
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

        &:hover {
            border: 2px solid lime;
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

            &.black {
                background-color: white;
                color: black;
            }

            &.selected {
                border: 4px solid red;
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
