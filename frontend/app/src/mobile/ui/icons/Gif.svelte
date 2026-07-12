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
    <path
        d="M16 0H2C0.9 0 0 0.9 0 2V16C0 17.1 0.9 18 2 18H16C17.1 18 18 17.1 18 16V2C18 0.9 17.1 0 16 0ZM7 7.5H4.5V10.5H5.5V9H7V10.7C7 11.4 6.5 12 5.7 12H4.3C3.5 12 3 11.3 3 10.7V7.4C3 6.7 3.5 6 4.3 6H5.6C6.5 6 7 6.7 7 7.3V7.5ZM10 12H8.5V6H10V12ZM14.5 7.5H13V8.5H14.5V10H13V12H11.5V6H14.5V7.5Z"
        transform="translate(0 3)"
        fill={color} />
</svg>
