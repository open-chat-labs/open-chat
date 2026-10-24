<script lang="ts">
    import { _ } from "svelte-i18n";
    import { discPairIndex, discPairs } from "./colours";

    // The disc colours beside the time, hints and streak; tapping moves to the next pair.
    let pair = $derived(discPairs[$discPairIndex]);
</script>

<button
    class="palette"
    aria-label={$_("dailyPuzzle.games.unruly.changeColours")}
    onclick={() => discPairIndex.set(($discPairIndex + 1) % discPairs.length)}>
    <span class="swatch" style:background-color={pair.a}></span>
    <span class="swatch" style:background-color={pair.b}></span>
</button>

<style lang="scss">
    .palette {
        display: flex;
        align-self: center;
        gap: $sp2;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
    }

    .swatch {
        width: toRem(20);
        height: toRem(20);
        border-radius: 50%;
        // both UI trees use this, so no theme token: grey reads on light and dark
        border: 1px solid rgba(128, 128, 128, 0.6);
    }
</style>
