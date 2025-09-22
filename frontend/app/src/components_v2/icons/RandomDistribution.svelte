<script lang="ts">
    interface Props {
        size?: string;
        width?: string;
        height?: string;
        color?: string;
        viewBox?: string;
    }

    let {
        size = "1em",
        width = size,
        height = size,
        color = "currentColor",
        viewBox = "0 0 100 100",
    }: Props = $props();
</script>

<svg {viewBox} {height} {width}>
    <line
        style={`stroke: ${color}; stroke-miterlimit: 14.72; stroke-width: 2px;`}
        x1="10"
        y1="10"
        x2="10"
        y2="90" />
    <line
        style={`stroke: ${color}; stroke-miterlimit: 14.72; stroke-linecap: square; stroke-width: 2px;`}
        x1="10"
        y1="90"
        x2="90"
        y2="90" />
    <line class="bar" style={`stroke: ${color}`} x1="18" y1="30" x2="18" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="26" y1="60" x2="26" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="34" y1="47" x2="34" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="42" y1="20" x2="42" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="50" y1="80" x2="50" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="58" y1="52" x2="58" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="66" y1="65" x2="66" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="74" y1="34" x2="74" y2="85" />
    <line class="bar" style={`stroke: ${color}`} x1="82" y1="40" x2="82" y2="85" />
</svg>

<style lang="scss">
    .bar {
        stroke-width: 5px;
    }
</style>
