<script lang="ts">
    export let value: number;
    export let min: number;
    export let max: number;
</script>

<input class="range-input" type="range" {min} {max} bind:value on:change />

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
</style>
