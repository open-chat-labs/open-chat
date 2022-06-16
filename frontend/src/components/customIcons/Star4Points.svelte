<script>
    export let size = "1em";
    export let width = size;
    export let height = size;
    export let color = "currentColor";
    export let viewBox = "0 0 24 24";
</script>

<svg {width} {height} {viewBox}>
    <path d="M12,1L9,9L1,12L9,15L12,23L15,15L23,12L15,9L12,1Z" fill={color} />
</svg>
