<script lang="ts">
    import { onMount } from "svelte";

    let ring: SVGElement;
    let sliceCount = 0;
    let totalAngle = 0;

    const sliceAngles = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

    function nextIteration() {
        totalAngle += sliceAngles[sliceCount];
        ring.setAttribute(
            "d",
            `M ${50 + 40 * Math.sin((totalAngle * Math.PI) / 180)} ${
                50 - 40 * Math.cos((totalAngle * Math.PI) / 180)
            }
                            A 40 40 0 ${totalAngle > 180 ? 1 : 0} 1 ${
                50 + 40 * Math.sin(((totalAngle + sliceAngles[sliceCount]) * Math.PI) / 180)
            } ${50 - 40 * Math.cos(((totalAngle + sliceAngles[sliceCount]) * Math.PI) / 180)}
                            L ${
                                50 +
                                30 *
                                    Math.sin(
                                        ((totalAngle + sliceAngles[sliceCount]) * Math.PI) / 180
                                    )
                            } ${
                50 - 30 * Math.cos(((totalAngle + sliceAngles[sliceCount]) * Math.PI) / 180)
            }
                            A 30 30 0 ${totalAngle > 180 ? 1 : 0} 0 ${
                50 + 30 * Math.sin((totalAngle * Math.PI) / 180)
            } ${50 - 30 * Math.cos((totalAngle * Math.PI) / 180)}
                            Z`
        );
        sliceCount++;
        // if (sliceCount < sliceAngles.length) {
        //     requestAnimationFrame(drawSlice);
        // }
    }

    function animateDoughnut(sliceAngles: number[]) {
        requestAnimationFrame(nextIteration);
    }

    onMount(() => {
        // animateDoughnut(sliceAngles);
    });
</script>

<svg class="logo" viewBox="0 0 100 100">
    <defs>
        <mask id="mask">
            <rect width="100%" height="100%" fill="white" />
            <circle cx="50" cy="50" r="30" fill="black" />
        </mask>
    </defs>
    <circle
        bind:this={ring}
        id="ring"
        cx="50"
        cy="50"
        r="40"
        stroke="#000"
        stroke-width="10"
        fill="none"
        mask="url(#mask)" />
</svg>

<button on:click={nextIteration}>Next</button>

<style type="text/scss">
    .logo {
        width: 500px;
        height: 500px;
    }
</style>
