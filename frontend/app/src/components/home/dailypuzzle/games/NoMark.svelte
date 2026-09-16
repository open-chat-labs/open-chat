<script lang="ts">
    // The player's own "no" mark, drawn the same in every game: no bulb, no tent, no bridge,
    // no line. A small grey cross on the cell or edge centre, in gridSvg.ts units.
    interface Props {
        cx: number;
        cy: number;
    }

    let { cx, cy }: Props = $props();

    const SIZE = 1.1;
</script>

<line
    x1={cx - SIZE}
    y1={cy - SIZE}
    x2={cx + SIZE}
    y2={cy + SIZE}
    stroke="#8a8a8a"
    stroke-width="0.5"
    stroke-linecap="round"
    pointer-events="none" />
<line
    x1={cx - SIZE}
    y1={cy + SIZE}
    x2={cx + SIZE}
    y2={cy - SIZE}
    stroke="#8a8a8a"
    stroke-width="0.5"
    stroke-linecap="round"
    pointer-events="none" />
