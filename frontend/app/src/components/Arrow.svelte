<script lang="ts">
    export let color: string;
    export let rotate: number = 0;
    export let size = 16;

    $: style = rotate === 0 ? "" : `transform: rotate(${rotate}deg)`;
</script>

<svg
    {style}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path
        d="M8.68333 0.666992L6.78533 2.55233L10.9027 6.66966H0V9.33099H10.9027L6.78533 13.4483L8.68333 15.3337L16 8.00033L8.68333 0.666992Z"
        fill={color} />
</svg>

<style lang="scss">
    svg {
        transition: transform 200ms ease-in-out;
        transform-origin: 50%;
    }
</style>
