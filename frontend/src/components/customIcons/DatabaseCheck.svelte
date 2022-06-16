<script>
    export let size = "1em";
    export let width = size;
    export let height = size;
    export let color = "currentColor";
    export let tickColor = "green";
    export let viewBox = "0 0 24 24";
</script>

<svg {width} {height} {viewBox}>
    <path
        d="M12 3C16.42 3 20 4.79 20 7S16.42 11 12 11 4 9.21 4 7 7.58 3 12 3M4 9C4 11.21 7.58 13 12 13S20 11.21 20 9V12.08L19 12C16.41 12 14.2 13.64 13.36 15.94L12 16C7.58 16 4 14.21 4 12V9M4 14C4 16.21 7.58 18 12 18H13C13 19.05 13.27 20.04 13.75 20.9L12 21C7.58 21 4 19.21 4 17V14"
        fill={color} />
    <path
        d="M18 21.08L15.25 18.08L16.41 16.92L18 18.5L21.59 14.92L22.75 16.33L18 21.08"
        fill={tickColor} />
</svg>
