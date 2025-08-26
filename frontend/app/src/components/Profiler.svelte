<script lang="ts">
    import { profileStore } from "openchat-client";
    import Select from "./Select.svelte";

    let selectedMethod: string = $state("");
    let dragging = false;
    let style = $state(`bottom: 10px; left: 10px;`);
    let methods = $derived(Object.keys($profileStore));
    let series = $derived(selectedMethod !== "" ? $profileStore[selectedMethod] : []);
    let [min, max] = $derived(
        series.reduce(
            ([min, max], x) => {
                return [Math.min(min, x), Math.max(max, x)];
            },
            [Number.MAX_VALUE, Number.MIN_VALUE],
        ),
    );
    let range = $derived(max - min);
    let points = $derived(
        series
            .map((n, i) => {
                const belowMax = max - n;
                const y = (belowMax / range) * 200;
                const x = 40 * i;
                return `${x},${y}`;
            })
            .join(" "),
    );
    let average = $derived(
        series.length > 0 ? series.reduce((total, x) => total + x, 0) / series.length : 0,
    );

    let offset = { x: 0, y: 0 };

    function startDrag(ev: MouseEvent) {
        offset = { x: ev.offsetX, y: ev.offsetY };
        dragging = true;
    }

    function stopDrag() {
        dragging = false;
    }

    function drag(ev: MouseEvent) {
        if (dragging) {
            const top = ev.clientY - offset.y;
            const left = ev.clientX - offset.x;
            style = `top: ${top}px; left: ${left}px`;
        }
    }
</script>

<svelte:body onmouseup={stopDrag} onmousemove={drag} />

<div onmousedown={startDrag} class="profiler" {style}>
    <Select bind:value={selectedMethod}>
        <option value={""} selected disabled>Choose metric</option>
        {#each methods as method}
            <option value={method}>{method}</option>
        {/each}
    </Select>

    {#if selectedMethod !== ""}
        <div class="overview">
            <div class="average">
                Avg: {average.toFixed(2)}ms
            </div>
            <div class="min">
                Min: {min.toFixed(2)}ms
            </div>
            <div class="max">
                Max: {max.toFixed(2)}ms
            </div>
        </div>

        <div class="graph">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
                <line x1="0" y1="0" x2="0" y2="200" stroke="black" />
                <line x1="0" y1="200" x2="400" y2="200" stroke="black" />
                <polyline {points} fill="none" stroke="red" stroke-width="2" />
            </svg>
        </div>
    {/if}
</div>

<style lang="scss">
    .profiler {
        padding: $sp4;
        width: 400px;
        height: 300px;
        background-color: rgba(255, 255, 255, 0.5);
        @include box-shadow(3);
        @include z-index("profiler");
        position: absolute;
    }

    .overview {
        display: flex;
        align-items: center;
        justify-content: space-between;
        @include font(light, normal, fs-70);
        margin-bottom: $sp3;
    }
</style>
