<script lang="ts">
    export let size = "1em";
    export let width = size;
    export let height = size;
    export let strokeWidth = "3px";
    export let foregroundColour = "currentColor";
    export let backgroundColour = "currentColor";
    export let viewBox = "0 0 24 24";
</script>

<svg {width} {height} {viewBox}>
    <ellipse
        style={`fill: none; stroke: ${foregroundColour}; stroke-width: ${strokeWidth};`}
        cx="12"
        cy="12"
        rx="10"
        ry="10" />
    <path
        d="M 11.614 2 C 14.524 2 17.159 3.018 19.046 4.871 C 20.997 6.787 22.038 9.496 22.008 12.412"
        style={`fill: none; stroke: ${backgroundColour}; stroke-width: ${strokeWidth};`} />
</svg>

<style lang="scss">
    svg {
        @include spin(0.8s);
    }
</style>
