<script lang="ts">
    import { _ } from "svelte-i18n";
    import { fontSizeScale, setFontSize } from "../../../stores/fontSize";
</script>

<div class="grid">
    <div class="letter zero" on:click={() => setFontSize(0)}>A</div>
    <div class="letter one" on:click={() => setFontSize(1)}>A</div>
    <div class="letter two" on:click={() => setFontSize(2)}>A</div>
    <div class="letter three" on:click={() => setFontSize(3)}>A</div>
    <div class="letter four" on:click={() => setFontSize(4)}>A</div>
    <div class="slider">
        <input class="range-input" type="range" min={0} max={4} bind:value={$fontSizeScale} />
    </div>
</div>

<style type="text/scss">
    .grid {
        display: grid;
        grid-template-columns: 1fr repeat(3, 2fr) 1fr;
        align-items: flex-end;
    }

    .slider {
        grid-column: 1 / span 8;
        .range-input {
            width: 100%;
        }
    }

    .letter {
        cursor: pointer;
        text-align: center;
        padding: 0 $sp2;
    }

    .zero {
        font-size: 12px;
        font-weight: 100;
        text-align: left;
    }

    .one {
        font-size: 14px;
        font-weight: 200;
    }

    .two {
        font-size: 16px;
        font-weight: 300;
    }

    .three {
        font-size: 18px;
        font-weight: 400;
    }

    .four {
        font-size: 20px;
        font-weight: 500;
        text-align: right;
    }
</style>
