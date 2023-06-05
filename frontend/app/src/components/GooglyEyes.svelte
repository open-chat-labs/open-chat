<script lang="ts">
    let leftEye: SVGRectElement;
    let rightEye: SVGRectElement;
    let lx = 117;
    let ly = 176;
    let rx = 227;
    let ry = 176;
    let enable = true;

    let lpos = {
        x: lx,
        y: ly,
    };
    let rpos = { x: rx, y: ry };

    type Point = { x: number; y: number };

    function center(rect: DOMRect): Point {
        return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
        };
    }

    function move(eye: Point, mouse: Point): Point {
        const rad = Math.atan2(mouse.y - eye.y, mouse.x - eye.x);
        const dy = Math.sin(rad) * 10;
        const dx = Math.cos(rad) * 10;
        return {
            x: dx,
            y: dy,
        };
    }

    function mouseMove(ev: MouseEvent) {
        if (!enable) return;
        enable = false;
        const l = center(leftEye.getBoundingClientRect());
        const r = center(rightEye.getBoundingClientRect());
        const mouse = { x: ev.clientX, y: ev.clientY };
        const dl = move(l, mouse);
        const dr = move(r, mouse);
        lx = lpos.x + dl.x;
        ly = lpos.y + dl.y;
        rx = rpos.x + dr.x;
        ry = rpos.y + dr.y;
        window.setTimeout(() => (enable = true), 100);
    }
</script>

<svelte:window on:mouseenter={mouseMove} on:mousemove={mouseMove} />

<rect
    class="eye"
    bind:this={rightEye}
    x={rx}
    y={ry}
    width="15.579"
    height="15.579"
    style="stroke: rgb(51,51,51); fill: rgb(25, 25, 25);" />
<rect
    class="eye"
    bind:this={leftEye}
    x={lx}
    y={ly}
    width="15.579"
    height="15.579"
    style="stroke: rgb(51,51,51); fill: rgb(25, 25, 25);" />

<style lang="scss">
    .eye {
        transition: x 100ms ease-in-out, y 100ms ease-in-out;
    }
</style>
