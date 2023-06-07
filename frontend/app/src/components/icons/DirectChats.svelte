<script lang="ts">
    export let size = "1em";
    export let width = size;
    export let height = size;
    export let color = "currentColor";
    export let viewBox = "0 0 24 24";
</script>

<svg {width} {height} {viewBox}>
    <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M24 20.001H21V24.001L15.667 20.001H8V16.001H10V18.001H16.333L19 20.001V18.001H22V10H20V8H24V20.001ZM8.333 14.001L3 18.001V14.001H0V0L18 0.001V14.001H8.333ZM2 12.001H5V14.001L7.667 12.001H16V2.001L2 2V12.001Z"
        fill={color} />
</svg>

<style lang="scss">
</style>
