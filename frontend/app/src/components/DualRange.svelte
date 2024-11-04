<script lang="ts">
    export let lowerValue: number;
    export let upperValue: number;
    export let min: number;
    export let max: number;

    $: {
        if (upperValue < lowerValue) {
            upperValue = lowerValue;
        }
    }
</script>

<div class="wrapper">
    <div class="sliders">
        <input
            class="from range-input"
            type="range"
            {min}
            {max}
            bind:value={lowerValue}
            on:change />
        <input class="to range-input" type="range" {min} {max} bind:value={upperValue} on:change />
    </div>
    <div class="form">
        <div class="val lower">{lowerValue}</div>
        <div class="val upper">{upperValue}</div>
    </div>
</div>

<style lang="scss">
    $trackHeight: 6px;
    $thumbSize: 16px;
    $trackColor: var(--button-bg);

    .wrapper {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        margin-bottom: $sp4;
    }

    .form {
        display: flex;
        justify-content: space-between;

        .val {
            padding: $sp2 $sp3;
            border: 1px solid var(--bd);
            border-radius: var(--rd);
            @include font(book, normal, fs-80);
        }
    }

    .sliders {
        position: relative;
        height: 20px;

        .from {
            height: 0;
            z-index: 1;
        }
    }

    input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        height: 2px;
        margin: 18px 0;
        width: 100%;
        position: absolute;
        background-color: #c6c6c6;
        pointer-events: none;
    }

    input[type="range"]:focus {
        outline: none;
    }

    // style the thumb
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        pointer-events: all;
        width: $thumbSize;
        height: $thumbSize;
        background-color: #fff;
        border-radius: 50%;
        cursor: pointer;
        margin-top: -5px;
    }

    input[type="range"]::-moz-range-thumb {
        appearance: none;
        -webkit-appearance: none;
        pointer-events: all;
        width: $thumbSize;
        height: $thumbSize;
        background-color: #fff;
        border-radius: 50%;
        cursor: pointer;
        margin-top: -$thumbSize;
    }

    input[type="range"]::-ms-thumb {
        height: $thumbSize;
        width: $thumbSize;
        border-radius: 50%;
        background: #ffffff;
        cursor: pointer;
        margin-top: -$thumbSize;
    }

    // style the track
    input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: $trackColor;
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

    input[type="range"]::-ms-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: transparent;
        border-color: transparent;
        border-width: 16px 0;
        color: transparent;
    }

    input.from[type="range"]::-webkit-slider-runnable-track {
        background: transparent;
    }

    input.from[type="range"]:focus::-webkit-slider-runnable-track {
        background: transparent;
    }

    input.from[type="range"]::-moz-range-track {
        background: transparent;
    }
</style>
