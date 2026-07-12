<script lang="ts">
    import { onMount } from "svelte";
    import { cubicInOut } from "svelte/easing";
    import { Tween } from "svelte/motion";

    interface Props {
        loop?: boolean;
        size?: string;
    }

    let { loop = true, size }: Props = $props();

    let style = $derived(size === undefined ? "" : `width: ${size}; height: ${size};`);
    let canvas: HTMLCanvasElement | undefined = $state();
    let ctx: CanvasRenderingContext2D | null | undefined;
    let speed = 800;
    let purpleTarget = 270;
    let orangeTarget = $state(45);

    let phase: 1 | 2 | 3 | 4 | 5 = $state(1);

    const options = { duration: speed, easing: cubicInOut };

    const purpleEnd = new Tween(-90, options);
    const orangeStart = new Tween(-90, options);
    const orangeEnd = new Tween(-90, options);

    function resetOrange() {
        phase = 2;
        orangeTarget = 45;
        Promise.all([
            orangeStart.set(-90, { duration: 0 }),
            orangeEnd.set(-90, { duration: 0 }),
        ]).then(() => {
            orangeStart.target = 45;
            orangeEnd.target = 315;
        });
    }

    function plotPurple(end: number) {
        if (!ctx) return;
        ctx.clearRect(0, 0, 500, 500);
        drawDoughnut(-90, end);
        ctx.fillStyle = createPurple(ctx);
        ctx.fill();
    }

    function plotOrange(start: number, end: number) {
        if (!ctx) return;
        ctx.clearRect(0, 0, 500, 500);
        drawPurple();
        drawDoughnut(start, end);
        ctx.fillStyle = createOrange(ctx);
        ctx.fill();
    }

    function drawDoughnut(startAngle: number, endAngle: number, counterClockwise: boolean = false) {
        if (!ctx) return;

        const cx = 250;
        const cy = 250;
        const innerRadius = 140;
        const outerRadius = 250;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const startOfOuterArcX = outerRadius * Math.cos(endRad) + cx;
        const startOfOuterArcY = outerRadius * Math.sin(endRad) + cy;

        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, startRad, endRad, counterClockwise);
        ctx.lineTo(startOfOuterArcX, startOfOuterArcY);
        ctx.arc(cx, cy, outerRadius, endRad, startRad, !counterClockwise);
        ctx.closePath();
    }

    function drawPurple() {
        if (!ctx) return;

        drawDoughnut(-90, 270);
        ctx.fillStyle = createPurple(ctx);
        ctx.fill();
    }

    function createOrange(ctx: CanvasRenderingContext2D): CanvasGradient {
        const orange = ctx.createLinearGradient(0, 0, 500, 500);
        orange.addColorStop(0, "rgb(251, 176, 59)");
        orange.addColorStop(1, "rgb(240, 90, 36)");
        return orange;
    }

    function createPurple(ctx: CanvasRenderingContext2D): CanvasGradient {
        const purple = ctx.createLinearGradient(0, 0, 500, 500);
        purple.addColorStop(0, "rgb(95, 37, 131)");
        purple.addColorStop(1, "rgb(237, 30, 121)");
        return purple;
    }

    onMount(() => {
        ctx = canvas?.getContext("2d");
        if (!ctx) return;
        purpleEnd.set(270);
    });
    $effect(() => {
        if (phase === 1) {
            if (purpleEnd.current >= purpleTarget) {
                phase = 2;
                orangeStart.target = 45;
                orangeEnd.target = 315;
            }
            plotPurple(purpleEnd.current);
        }
    });
    $effect(() => {
        plotOrange(orangeStart.current, orangeEnd.current);
        if (loop || phase > 2) {
            if (phase === 2) {
                if (orangeStart.current >= orangeTarget) {
                    phase = 3;
                    orangeTarget = 270;
                    orangeStart.target = 270;
                    orangeEnd.target = 630;
                }
            }
            if (phase === 3) {
                if (orangeStart.current >= orangeTarget) {
                    phase = 4;
                    orangeTarget = 630;
                    orangeStart.target = 630;
                }
            }
            if (phase === 4) {
                if (orangeStart.current >= orangeTarget) {
                    phase = 5;
                    orangeEnd.target = 630;
                }
            }
            if (phase === 5) {
                if (orangeEnd.current >= orangeTarget) {
                    resetOrange();
                }
            }
        }
    });
</script>

<canvas {style} width={500} height={500} class="logo" bind:this={canvas}></canvas>

<style lang="scss">
    .logo {
        width: 100%;
    }
</style>
