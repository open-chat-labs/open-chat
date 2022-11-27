<script lang="ts">
    import type { TextContent, ReplyContext } from "openchat-client";
    import ChessPieces from "../ChessPieces.svelte";

    export let repliesTo: ReplyContext | undefined = undefined;
    export let content: TextContent;

    let letters = "abcdefgh";

    const board = new Array(8).fill(new Array(8).fill(0));

    type Colour = "white" | "black";

    type PieceType = "pawn" | "rook" | "bishop" | "knight" | "king" | "queen";

    type Pieces = Record<string, Piece>;

    type Game = {
        state: Pieces;
        next: Colour;
    };

    type Piece = {
        colour: Colour;
        type: PieceType;
    };

    function parseMove(txt: string): [string, string] | undefined {
        const move = txt.replace("/chess", "").trim();
        return move === ""
            ? undefined
            : (move.split("->").map((m) => m.trim()) as [string, string]);
    }

    function move(state: Pieces, m: [string, string] | undefined): Pieces {
        if (m === undefined) return state;
        const [from, to] = m;
        console.log("MOVE: ", m);
        const current = state[from];
        if (current) {
            state[to] = current;
            delete state[from];
        }
        return state;
    }

    $: state = move(initialState, parseMove(content.text));

    $: console.log("STATE: ", state);

    const initialState: Record<string, Piece> = {
        a8: { colour: "white", type: "rook" },
        b8: { colour: "white", type: "knight" },
        c8: { colour: "white", type: "bishop" },
        d8: { colour: "white", type: "queen" },
        e8: { colour: "white", type: "king" },
        f8: { colour: "white", type: "bishop" },
        g8: { colour: "white", type: "knight" },
        h8: { colour: "white", type: "rook" },
        a7: { colour: "white", type: "pawn" },
        b7: { colour: "white", type: "pawn" },
        c7: { colour: "white", type: "pawn" },
        d7: { colour: "white", type: "pawn" },
        e7: { colour: "white", type: "pawn" },
        f7: { colour: "white", type: "pawn" },
        g7: { colour: "white", type: "pawn" },
        h7: { colour: "white", type: "pawn" },
        a2: { colour: "black", type: "pawn" },
        b2: { colour: "black", type: "pawn" },
        c2: { colour: "black", type: "pawn" },
        d2: { colour: "black", type: "pawn" },
        e2: { colour: "black", type: "pawn" },
        f2: { colour: "black", type: "pawn" },
        g2: { colour: "black", type: "pawn" },
        h2: { colour: "black", type: "pawn" },
        a1: { colour: "black", type: "rook" },
        b1: { colour: "black", type: "knight" },
        c1: { colour: "black", type: "bishop" },
        d1: { colour: "black", type: "queen" },
        e1: { colour: "black", type: "king" },
        f1: { colour: "black", type: "bishop" },
        g1: { colour: "black", type: "knight" },
        h1: { colour: "black", type: "rook" },
    };

    function pos(c: number, r: number): string {
        return `${letters[c]}${Math.abs(r - 8)}`;
    }
</script>

<div class="letters">
    <div class="letter" />
    <div class="letter">A</div>
    <div class="letter">B</div>
    <div class="letter">C</div>
    <div class="letter">D</div>
    <div class="letter">E</div>
    <div class="letter">F</div>
    <div class="letter">G</div>
    <div class="letter">H</div>
    <div class="letter" />
</div>

<div class="wrapper">
    <div class="side">
        <div class="num">8</div>
        <div class="num">7</div>
        <div class="num">6</div>
        <div class="num">5</div>
        <div class="num">4</div>
        <div class="num">3</div>
        <div class="num">2</div>
        <div class="num">1</div>
    </div>
    <div class="board">
        {#each board as row, r}
            {#each row as col, c}
                <div class="cell" class:black={(r + c) % 2 === 0}>
                    {#if state[pos(c, r)]}
                        <ChessPieces type={state[pos(c, r)].type} color={state[pos(c, r)].colour} />
                    {/if}
                </div>
            {/each}
        {/each}
    </div>
    <div class="side">
        <div class="num">8</div>
        <div class="num">7</div>
        <div class="num">6</div>
        <div class="num">5</div>
        <div class="num">4</div>
        <div class="num">3</div>
        <div class="num">2</div>
        <div class="num">1</div>
    </div>
</div>
<div class="letters">
    <div class="letter" />
    <div class="letter">A</div>
    <div class="letter">B</div>
    <div class="letter">C</div>
    <div class="letter">D</div>
    <div class="letter">E</div>
    <div class="letter">F</div>
    <div class="letter">G</div>
    <div class="letter">H</div>
    <div class="letter" />
</div>

<style type="text/scss">
    $size: 40px;

    .wrapper {
        display: flex;

        .side {
            flex: 0 0 $size;
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
