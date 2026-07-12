<script lang="ts">
    interface Props {
        dark: string;
        medium: string;
        light: string;
        size: string;
        y?: any;
    }

    let { dark, medium, light, size, y = -40 }: Props = $props();

    let width = size;
    let height = size;
</script>

<svg class="diamond" viewBox={`0 ${y} 500 430`} {width} {height}>
    <g transform="matrix(0.714286, 0, 0, 0.714286, -3.571425, -3.585709)">
        <g>
            <polygon fill={dark} points="705,185.771 355,605.022 505.434,226.293 &#9;" />
            <polygon
                fill={medium}
                points="705,185.771 505.434,226.293 452.352,5.041 523.162,5.041 &#9;" />
            <g>
                <polygon
                    fill={light}
                    points="355,605.02 5.02,185.8 5,185.77 5.04,185.78 204.57,226.29 &#9;&#9;" />
                <polyline fill="none" points="5.01,185.81 5.02,185.8 5.04,185.78 &#9;&#9;" />
            </g>
            <polygon
                fill={light}
                points="505.43,226.29 204.57,226.29 257.65,5.04 452.35,5.04 &#9;" />
            <polygon fill={medium} points="505.434,226.293 355,605.022 204.566,226.293 &#9;" />
            <polygon
                fill={"white"}
                stroke={dark}
                stroke-width="0.25"
                stroke-miterlimit="10"
                points="452.35,5.04 257.65,5.04 &#10;&#9;&#9;204.57,226.29 5.04,185.78 186.85,5.02 &#9;" />
            <polyline
                fill="none"
                stroke={light}
                stroke-width="0.25"
                stroke-miterlimit="10"
                points="186.85,5.02 5,185.77 5.02,185.8 &#10;&#9;&#9;355,605.02 705,185.77 523.16,5.04 452.35,5.04 &#9;" />
        </g>
    </g>
</svg>
