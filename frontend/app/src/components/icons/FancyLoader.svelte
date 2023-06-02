<script lang="ts">
    import { onMount } from "svelte";
    import { cubicInOut } from "svelte/easing";
    import { tweened } from "svelte/motion";

    export let loop = true;

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let speed = 800;
    let purpleTarget = 270;
    let orangeTarget = 45;

    let phase: 1 | 2 | 3 | 4 | 5 = 1;

    const options = { duration: speed, easing: cubicInOut };

    const purpleEnd = tweened(-90, {
        duration: speed,
        easing: cubicInOut,
    });

    let orangeStart = tweened(-90, options);
    let orangeEnd = tweened(-90, options);

    function resetOrange() {
        phase = 2;
        orangeTarget = 45;
        orangeStart = tweened(-90, options);
        orangeEnd = tweened(-90, options);
        orangeStart.set(45);
        orangeEnd.set(315);
    }

    $: {
        if (phase === 1) {
            if ($purpleEnd >= purpleTarget) {
                phase = 2;
                orangeStart.set(45);
                orangeEnd.set(315);
            }
            plotPurple($purpleEnd);
        }
    }

    $: {
        plotOrange($orangeStart, $orangeEnd);
        if (loop) {
            if (phase === 2) {
                if ($orangeStart >= orangeTarget) {
                    phase = 3;
                    orangeTarget = 270;
                    orangeStart.set(270);
                    orangeEnd.set(630);
                }
            }
            if (phase === 3) {
                if ($orangeStart >= orangeTarget) {
                    phase = 4;
                    orangeTarget = 630;
                    orangeStart.set(630);
                }
            }
            if (phase === 4) {
                if ($orangeStart >= orangeTarget) {
                    phase = 5;
                    orangeEnd.set(630);
                }
            }
            if (phase === 5) {
                if ($orangeEnd >= orangeTarget) {
                    resetOrange();
                }
            }
        }
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
        ctx = canvas.getContext("2d");
        if (!ctx) return;
        purpleEnd.set(270);
    });
</script>

<canvas width="500" height="500" class="logo" bind:this={canvas} />

<style type="text/scss">
    .logo {
        width: 100%;
    }
</style>
