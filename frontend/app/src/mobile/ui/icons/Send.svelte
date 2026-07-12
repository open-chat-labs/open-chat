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
        viewBox = "0 0 24 24",
    }: Props = $props();
</script>

<svg {width} {height} {viewBox}>
    <path fill={color} d="M3 20V4L22 12M5 17L16.85 12L5 7V10.5L11 12L5 13.5M5 17V7 13.5Z" /></svg>
