<script lang="ts">
    interface Props {
        value: number;
        min: number;
        max: number;
        fat?: boolean;
        onChange?: () => void;
    }

    let { value = $bindable(), min, max, fat = false, onChange }: Props = $props();

    let trackHeight = fat ? 9 : 6;
    let thumbSize = fat ? 26 : 16;
</script>

<input
    style={`--track-height: ${trackHeight}px; --thumb-size: ${thumbSize}px;`}
    class="range-input"
    type="range"
    {min}
    {max}
    bind:value
    onchange={onChange} />

<style lang="scss">
    $trackHeight: var(--track-height);
    $thumbSize: var(--thumb-size);
    $trackColor: var(--gradient);

    input[type="range"] {
        -webkit-appearance: none;
        margin: 18px 0;
        width: 100%;
        border-radius: var(--rad-circle);
    }
    input[type="range"]:focus {
        outline: none;
    }
    input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: $trackColor;
        border-radius: var(--rad-circle);
    }
    input[type="range"]::-webkit-slider-thumb {
        height: $thumbSize;
        width: $thumbSize;
        border-radius: 50%;
        background: #ffffff;
        border: 1px solid var(--bd);
        cursor: pointer;
        -webkit-appearance: none;
        margin-top: calc(-1 * $trackHeight);
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
        border: 1px solid var(--bd);
        cursor: pointer;
    }
    input[type="range"]::-ms-track {
        width: 100%;
        height: $trackHeight;
        cursor: pointer;
        background: transparent;
        border-color: transparent;
        border-width: $thumbSize 0;
        color: transparent;
    }
    input[type="range"]::-ms-thumb {
        height: $thumbSize;
        width: $thumbSize;
        border-radius: 50%;
        background: #ffffff;
        border: 1px solid var(--bd);
        cursor: pointer;
    }
</style>
