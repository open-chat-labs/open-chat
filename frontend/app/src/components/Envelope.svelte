<script lang="ts">
    export let symbol: string;
</script>

<div class="envelope">
    <div class="back" />
    <div class="letter">
        <div class="text">{symbol}</div>
    </div>
    <div class="front" />
    <div class="top" />
</div>

<style lang="scss">
    // $color: slateblue;
    $color: crimson;
    $front: darken($color, 5%);
    $top: lighten($color, 5%);
    $sides: $color;
    $back: darken($color, 20%);
    $width: 80px;
    $height: calc(#{$width} * 0.8);
    $delay: 0.15s;

    .envelope {
        position: relative;
        cursor: pointer;
    }

    .back {
        position: relative;
        width: $width;
        height: $height;
        background-color: $back;
    }

    .letter {
        position: absolute;
        background-color: #fff;
        width: calc(#{$width} * 0.92);
        height: calc(#{$height} * 0.85);
        top: 8px;
        left: calc(#{$width} * 0.04);
        transition: 0.3s;
        color: #191919;
        z-index: 0;
    }

    .text {
        text-align: center;
        @include font(bold, normal, fs-110);
        margin-top: 10px;
    }

    .front {
        position: absolute;
        border-right: calc(#{$width} * 0.52) solid $sides;
        border-top: calc(#{$height} * 0.5) solid transparent;
        border-bottom: calc(#{$height} * 0.5) solid transparent;
        height: 0;
        width: 0;
        top: 0;
        left: calc(#{$width} * 0.48);
        z-index: 3;
    }

    .front:before {
        content: "";
        position: absolute;
        border-left: calc(#{$width} * 0.52) solid $sides;
        border-top: calc(#{$height} * 0.5) solid transparent;
        border-bottom: calc(#{$height} * 0.5) solid transparent;
        height: 0;
        width: 0;
        top: calc(#{$height} * 0.5 * -1);
        left: calc(#{$width} * 0.48 * -1);
    }

    .front:after {
        content: "";
        position: absolute;
        border-bottom: calc(#{$height} * 0.525) solid $front;
        border-left: calc(#{$width} * 0.5) solid transparent;
        border-right: calc(#{$width} * 0.5) solid transparent;
        height: 0;
        width: 0;
        top: calc(#{$height} * 0.025 * -1);
        left: calc(#{$width} * 0.48 * -1);
    }

    .top {
        position: absolute;
        border-top: calc(#{$height} * 0.525) solid $top;
        border-left: calc(#{$width} * 0.5) solid transparent;
        border-right: calc(#{$width} * 0.5) solid transparent;
        height: 0;
        width: 0;
        top: 0;
        transform-origin: top;
        transition: 0.4s;
        transition-delay: $delay;
    }

    .envelope:hover .top {
        transform: rotateX(160deg);
        transition-delay: 0ms;
    }

    .envelope:hover .letter {
        transform: translateY(calc(#{$height} * 0.5 * -1));
        transition-delay: $delay;
        z-index: 2;
    }
</style>
