<script lang="ts">
    import { onMount } from "svelte";

    type Tile = {
        idx: number;
        class: string;
        pos: string;
    };

    function shuffleArray(tiles: Tile[]) {
        for (let i = tiles.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            if (tiles[i].idx === 0) continue; // skip the blank tile
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }
        return tiles;
    }

    function generateRandomSolvablePuzzle(tiles: Tile[]) {
        let inversions = 0;
        let counter = 0;
        while (counter < 100) {
            shuffleArray(tiles);
            inversions = 0;
            for (let i = 0; i < tiles.length; i++) {
                for (let j = i + 1; j < tiles.length; j++) {
                    if (tiles[i].idx > tiles[j].idx && tiles[i].idx * tiles[j].idx !== 0) {
                        inversions++;
                    }
                }
            }
            if (inversions % 2 === 0) {
                return tiles;
            }
            counter++;
        }
        return tiles;
    }

    onMount(() => (shuffled = generateRandomSolvablePuzzle([...tiles])));

    let shuffled: Tile[] = [];

    let tiles = [
        {
            idx: 1,
            class: "one",
            pos: "left top",
        },
        {
            idx: 2,
            class: "two",
            pos: "center top",
        },
        {
            idx: 3,
            class: "three",
            pos: "right top",
        },
        {
            idx: 4,
            class: "four",
            pos: "left center",
        },
        {
            idx: 5,
            class: "five",
            pos: "center center",
        },
        {
            idx: 6,
            class: "six",
            pos: "right center",
        },
        {
            idx: 7,
            class: "seven",
            pos: "left bottom",
        },
        {
            idx: 8,
            class: "eight",
            pos: "center bottom",
        },
        {
            idx: 0,
            class: "nine",
            pos: "",
        },
    ];

    $: emptyIdx = shuffled.findIndex((t) => t.idx === 0);

    function adjacentToEmpty(idx: number): boolean {
        return (
            idx === emptyIdx + 1 ||
            idx === emptyIdx - 1 ||
            idx === emptyIdx + 3 ||
            idx === emptyIdx - 3
        );
    }

    function swap(a: number, b: number) {
        const tmp1 = shuffled[a];
        const tmp2 = shuffled[b];
        shuffled[a] = tmp2;
        shuffled[b] = tmp1;
        shuffled = shuffled; // force computed expressions to re-evaluate
    }

    function tileClicked(idx: number) {
        if (adjacentToEmpty(idx)) {
            swap(idx, emptyIdx);
        }
    }
</script>

<div class="puzzle">
    {#each shuffled as tile, i}
        <div
            on:click={() => tileClicked(i)}
            class={`tile ${tile.class}`}
            style={`background-position: ${tile.pos}`} />
    {/each}
</div>

<style type="text/scss">
    .puzzle {
        display: grid;
        gap: $sp3;
        grid-template-columns: 1fr 1fr 1fr;
        grid-template-rows: 1fr 1fr 1fr;
        width: 360px;
        height: 360px;
    }

    .tile {
        $size: 120px;
        display: table-cell;
        border: 1px solid rgba(255, 255, 255, 0.5);
        cursor: pointer;
        width: $size;
        height: $size;
        background: url("../assets/bitcoin.jpg");

        &.nine {
            background: none;
            background-color: var(--bg);
        }
    }
</style>
