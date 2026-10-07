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
        viewBox = "0 0 107.8 124.2",
    }: Props = $props();
</script>

<svg {width} {height} {viewBox}>
    <path
        d="M107.8,0L0,39.7v84.5l69.6-23.4v21.9l21.1-29l17.1-5.8V0z M65.3,91.4l-14.8,4.8V47.8l-0.2,0.1l-7.2,50.7
	l-10.7,3.5l-7-45.3l-0.2,0.1v47.6l-14.1,4.6V45.5l22.2-8.1l4.4,36.2l0.2-0.1l4-39.2l23.4-8.6L65.3,91.4L65.3,91.4z M100,26.5
	L87.5,31v12.2l10.7-3.8v13l-10.7,3.7v28.1L69.6,90V24L100,12.9V26.5z"
        fill={color} />
</svg>
