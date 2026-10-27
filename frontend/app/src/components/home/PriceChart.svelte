<!-- A chart of token prices which the reader can explore: hovering over it, pressing and dragging
     along it, or with the arrow keys, shows the prices at that time (logic/priceChart). So far only
     one token's chart is drawn: several tokens' lines get their colours with price chart messages. -->
<script lang="ts">
    import {
        PriceChartReader,
        priceChartLayout,
        readingAt,
        readingText,
        readingTime,
        readingValue,
        type PriceChartData,
    } from "@src/logic/priceChart/priceChart.svelte";
    import { formatUsdPrice } from "@client";
    import { locale } from "svelte-i18n";

    interface Props {
        data: PriceChartData;
        // what the chart shows, eg. "CHAT's price over the last 7 days"
        label: string;
    }

    let { data, label }: Props = $props();

    let width = $state(0);
    let height = $state(0);
    const reader = new PriceChartReader();

    let layout = $derived(priceChartLayout(data, width, height));
    let reading = $derived(
        layout !== undefined && reader.timestamp !== undefined
            ? readingAt(data, layout, reader.timestamp)
            : undefined,
    );
    // the reading sits beside the line, on whichever side has more room
    let readingOnLeft = $derived(reading !== undefined && reading.x > width / 2);

    function pointAt(ev: PointerEvent) {
        if (layout === undefined) return;
        const bounds = (ev.currentTarget as HTMLElement).getBoundingClientRect();
        reader.pointAt(data, layout, ev.clientX - bounds.left);
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (reader.key(data, ev.key)) {
            ev.preventDefault();
        }
    }
</script>

<div
    class="price-chart"
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={data.start}
    aria-valuemax={data.end}
    aria-valuenow={reading?.timestamp ?? data.end}
    aria-valuetext={reading !== undefined && layout !== undefined
        ? readingText(data, layout, reading, $locale ?? "en")
        : label}
    bind:clientWidth={width}
    bind:clientHeight={height}
    onpointerdown={pointAt}
    onpointermove={pointAt}
    onpointerleave={() => reader.clear()}
    onpointercancel={() => reader.clear()}
    onblur={() => reader.clear()}
    onkeydown={onKeyDown}>
    {#if layout !== undefined}
        <svg width={layout.width} height={layout.height} aria-hidden="true">
            {#each layout.lines as line}
                {#if line.area !== undefined}
                    <path class="area" class:falling={!line.rising} d={line.area} />
                {/if}
            {/each}
            {#each layout.lines as line, i}
                <path
                    class={`line series-${i}`}
                    class:single={layout.kind === "usd"}
                    class:falling={!line.rising}
                    d={line.path} />
            {/each}
            {#each layout.marks as mark}
                <circle class="mark" cx={mark.x} cy={mark.y} r="3" />
            {/each}
            {#if reading !== undefined}
                <line class="crosshair" x1={reading.x} x2={reading.x} y1="0" y2={layout.height} />
            {/if}
            {#each layout.lines as line, i}
                {@const value = reading?.values.find((v) => v.symbol === line.symbol)}
                <circle
                    class={`dot series-${i}`}
                    class:single={layout.kind === "usd"}
                    class:falling={!line.rising}
                    cx={reading !== undefined && value !== undefined ? reading.x : line.end.x}
                    cy={value?.y ?? line.end.y}
                    r="4" />
            {/each}
        </svg>
        {#if reading === undefined}
            {#each layout.marks as mark}
                <span
                    class="mark-label"
                    class:low={mark.kind === "low"}
                    style:left={`clamp(2rem, ${mark.x}px, calc(100% - 2rem))`}
                    style:top={`${mark.y}px`}>{formatUsdPrice(mark.usd)}</span>
            {/each}
        {:else}
            <div
                class="reading"
                style:left={readingOnLeft ? undefined : `${reading.x + 8}px`}
                style:right={readingOnLeft ? `${width - reading.x + 8}px` : undefined}>
                <div class="time">{readingTime(data, reading.timestamp, $locale ?? "en")}</div>
                {#each reading.values as value}
                    <div class="value">{readingValue(layout, value)}</div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style lang="scss">
    .price-chart {
        position: relative;
        width: 100%;
        height: 100%;
        // a horizontal drag reads the chart, a vertical one still scrolls the page
        touch-action: pan-y;
        cursor: crosshair;
        user-select: none;
        outline-offset: 2px;
    }

    svg {
        display: block;
        overflow: visible;
    }

    .area {
        fill: var(--success);
        fill-opacity: 0.12;

        &.falling {
            fill: var(--error);
        }
    }

    .line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .line.single,
    .dot.single {
        stroke: var(--success);

        &.falling {
            stroke: var(--error);
        }
    }

    .dot {
        fill: var(--modal-bg);
        stroke-width: 2;

        &.single {
            fill: var(--success);

            &.falling {
                fill: var(--error);
            }
        }
    }

    .mark {
        fill: var(--txt-light);
    }

    .crosshair {
        stroke: var(--txt-light);
        stroke-width: 1;
        stroke-dasharray: 3 3;
    }

    .mark-label {
        position: absolute;
        transform: translate(-50%, calc(-100% - 4px));
        @include font(book, normal, fs-60);
        color: var(--txt-light);
        white-space: nowrap;
        pointer-events: none;

        &.low {
            transform: translate(-50%, 4px);
        }
    }

    .reading {
        position: absolute;
        top: 0;
        padding: $sp1 $sp2;
        border-radius: var(--modal-rd);
        background-color: var(--menu-bg);
        border: 1px solid var(--bd);
        color: var(--txt);
        @include font(book, normal, fs-70);
        white-space: nowrap;
        pointer-events: none;

        .time {
            color: var(--txt-light);
        }
    }
</style>
