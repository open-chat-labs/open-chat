<script lang="ts">
    interface Props {
        size?: string;
        width?: any;
        height?: any;
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
    <path
        d="M10.2 7L6.2 3H21V7H10.2M20 8H11.2L20 16.8V8M20 19.35V19.34L8.66 8H8.66L7.66 7H7.66L2.39 1.73L1.11 3L3 4.89V7H5.11L6.11 8H4V21H19.11L20.84 22.73L22.11 21.46L20 19.35Z"
        fill={color} />
</svg>
