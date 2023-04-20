<script lang="ts">
    export let size = "1em";
    export let width = size;
    export let height = size;
    export let color = "currentColor";
</script>

<svg
    fill-rule="evenodd"
    clip-rule="evenodd"
    {width}
    {height}
    image-rendering="optimizeQuality"
    shape-rendering="geometricPrecision"
    text-rendering="geometricPrecision"
    viewBox="0 0 4091.27 4091.73">
    <g fill-rule="nonzero">
        <circle
            class="circle"
            cx="2050"
            cy="2050"
            r="1900"
            fill="none"
            stroke={color}
            stroke-width="200" />
        <path
            class="logo"
            fill={color}
            d="M2947.77 1754.38c40.72-272.26-166.56-418.61-450-516.24l91.95-368.8-224.5-55.94-89.51 359.09c-59.02-14.72-119.63-28.59-179.87-42.34L2186 768.69l-224.36-55.94-92 368.68c-48.84-11.12-96.81-22.11-143.35-33.69l.26-1.16-309.59-77.31-59.72 239.78s166.56 38.18 163.05 40.53c90.91 22.69 107.35 82.87 104.62 130.57l-104.74 420.15c6.26 1.59 14.38 3.89 23.34 7.49-7.49-1.86-15.46-3.89-23.73-5.87l-146.81 588.57c-11.11 27.62-39.31 69.07-102.87 53.33 2.25 3.26-163.17-40.72-163.17-40.72l-111.46 256.98 292.15 72.83c54.35 13.63 107.61 27.89 160.06 41.3l-92.9 373.03 224.24 55.94 92-369.07c61.26 16.63 120.71 31.97 178.91 46.43l-91.69 367.33 224.51 55.94 92.89-372.33c382.82 72.45 670.67 43.24 791.83-303.02 97.63-278.78-4.86-439.58-206.26-544.44 146.69-33.83 257.18-130.31 286.64-329.61l-.07-.05zm-512.93 719.26c-69.38 278.78-538.76 128.08-690.94 90.29l123.28-494.2c152.17 37.99 640.17 113.17 567.67 403.91zm69.43-723.3c-63.29 253.58-453.96 124.75-580.69 93.16l111.77-448.21c126.73 31.59 534.85 90.55 468.94 355.05h-.02z" />
    </g>
</svg>

<style type="text/scss">
    // svg:hover {
    //     $speed: 100ms;
    //     .circle {
    //         transition: stroke $speed ease-in-out, fill $speed ease-in-out;
    //         stroke: #f7931a;
    //         fill: #f7931a;
    //     }

    //     .logo {
    //         transition: fill $speed ease-in-out;
    //         fill: var(--txt);
    //     }
    // }
</style>
