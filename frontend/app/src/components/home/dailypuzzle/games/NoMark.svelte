<script lang="ts">
    // The player's own "no" mark, drawn the same in every game: no bulb, no tent, no bridge,
    // no line. A small grey cross on the cell or edge centre, in gridSvg.ts units.
    interface Props {
        cx: number;
        cy: number;
        /** Darker on boards whose cells are coloured, where the grey washes out. */
        colour?: string;
        /** Half the width of the cross, in gridSvg.ts units. */
        size?: number;
    }

    let { cx, cy, colour = "#8a8a8a", size = 1.1 }: Props = $props();
</script>

<line
    x1={cx - size}
    y1={cy - size}
    x2={cx + size}
    y2={cy + size}
    stroke={colour}
    stroke-width="0.5"
    stroke-linecap="round"
    pointer-events="none" />
<line
    x1={cx - size}
    y1={cy + size}
    x2={cx + size}
    y2={cy - size}
    stroke={colour}
    stroke-width="0.5"
    stroke-linecap="round"
    pointer-events="none" />
