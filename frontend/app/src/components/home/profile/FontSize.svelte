<script lang="ts">
    import { fontScaleStore } from "openchat-client";
    import Range from "../../Range.svelte";
    // onChange={() => (ui.fontScale = $fontScaleStore)} />
</script>

<div class="grid">
    <div class="letter zero" onclick={() => fontScaleStore.set(0)}>A</div>
    <div class="letter one" onclick={() => fontScaleStore.set(1)}>A</div>
    <div class="letter two" onclick={() => fontScaleStore.set(2)}>A</div>
    <div class="letter three" onclick={() => fontScaleStore.set(3)}>A</div>
    <div class="letter four" onclick={() => fontScaleStore.set(4)}>A</div>
    <div class="slider">
        <Range min={0} max={4} bind:value={$fontScaleStore} />
    </div>
</div>

<style lang="scss">
    $trackHeight: 6px;
    $thumbSize: 16px;
    $trackColor: var(--button-bg);

    input[type="range"] {
        -webkit-appearance: none;
        margin: 18px 0;
        width: 100%;
    }
    input[type="range"]:focus {
        outline: none;
    }
    input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: $trackColor;
    }
    input[type="range"]::-webkit-slider-thumb {
        height: $thumbSize;
        width: $thumbSize;
        border-radius: 50%;
        background: #ffffff;
        cursor: pointer;
        -webkit-appearance: none;
        margin-top: -6px;
    }
    input[type="range"]:focus::-webkit-slider-runnable-track {
        background: $trackColor;
    }
    input[type="range"]::-moz-range-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: $trackColor;
    }
    input[type="range"]::-moz-range-thumb {
        height: $thumbSize;
        width: $thumbSize;
        border-radius: 50%;
        background: #ffffff;
        cursor: pointer;
    }
    input[type="range"]::-ms-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: transparent;
        border-color: transparent;
        border-width: 16px 0;
        color: transparent;
    }
    input[type="range"]::-ms-thumb {
        height: $thumbSize;
        width: $thumbSize;
        border-radius: 50%;
        background: #ffffff;
        cursor: pointer;
    }

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
