<script lang="ts">
    import { ScreenWidth, screenWidth } from "stores/screenDimensions";

    export let width: string;
    export let bottom: string;
    export let right: string = "unset";
    export let left: string = "unset";
    export let opacity: string;
    export let viewBox: string = "0 0 361 361";
    export let skew: string = "0deg";

    $: style = `width: ${width}; bottom: ${bottom}; right: ${right}; left: ${left}; opacity: ${opacity}; transform: skewX(${skew})`;

    $: show =
        $screenWidth === ScreenWidth.ExtraExtraLarge || $screenWidth === ScreenWidth.ExtraLarge;
</script>

{#if show}
    <div class="logo" {style}>
        <svg
            {viewBox}
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink">
            <defs>
                <linearGradient id="gradient-5">
                    <stop style="stop-color: #5f2583;" offset="0" />
                    <stop style="stop-color: rgb(240, 90, 36);" offset="1" />
                </linearGradient>
                <linearGradient id="gradient-6">
                    <stop style="stop-color: rgb(95, 37, 131);" offset="0" />
                    <stop style="stop-color: rgb(237, 30, 121);" offset="1" />
                </linearGradient>
                <linearGradient
                    id="gradient-6-1"
                    gradientUnits="userSpaceOnUse"
                    x1="973.216"
                    y1="100.665"
                    x2="973.216"
                    y2="388.077"
                    gradientTransform="matrix(0.974127, -0.22842, 0.310454, 1.352474, -95.300314, 85.515158)"
                    xlink:href="#gradient-6" />
                <linearGradient
                    id="gradient-5-0"
                    gradientUnits="userSpaceOnUse"
                    x1="188.919"
                    y1="1.638"
                    x2="188.919"
                    y2="361.638"
                    gradientTransform="matrix(-0.999999, 0.0016, -0.002016, -1.25907, 376.779907, 357.264557)"
                    xlink:href="#gradient-5" />
            </defs>
            <g transform="matrix(1, 0, 0, 1, -69.98674, -69.986298)">
                <path
                    d="M 188.919 181.638 m -180 0 a 180 180 0 1 0 360 0 a 180 180 0 1 0 -360 0 Z M 188.919 181.638 m -100 0 a 100 100 0 0 1 200 0 a 100 100 0 0 1 -200 0 Z"
                    style="fill: url(#gradient-5-0);"
                    transform="matrix(1, 0.000074, -0.000074, 1, 61.094498, 68.347626)" />
                <path
                    style="stroke-width: 0px; paint-order: stroke; fill: url(#gradient-6-1);"
                    transform="matrix(1.031731, 0.000001, 0, 1.020801, -634.597351, 0.544882)"
                    d="M 958.327234958 100.664699414 A 175.433 175.433 0 0 1 958.327234958 388.077300586 L 913.296322517 323.766492741 A 96.924 96.924 0 0 0 913.296322517 164.975507259 Z" />
                <circle
                    data-name="inner-circle"
                    style="fill: rgb(25, 25, 25);"
                    cx="250"
                    cy="250"
                    r="100" />
            </g>
        </svg>
    </div>
{/if}

<style lang="scss">
    .logo {
        position: absolute;
        z-index: -1;
    }
</style>
