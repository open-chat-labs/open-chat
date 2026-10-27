import type { TokenPricePoint } from "@client";
import {
    extremes,
    priceChange,
    PriceChartReader,
    priceChartCredit,
    priceChartLayout,
    priceChartTokens,
    readingAt,
    readingNear,
    readingShowsTime,
    readingText,
    readingValue,
    stepReading,
    type PriceChartData,
    type PriceChartLayout,
} from "./priceChart.svelte";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_792_926_499_000;

function point(ago: number, usd: number): TokenPricePoint {
    return { timestamp: NOW - ago, usd };
}

function week(...series: TokenPricePoint[][]): PriceChartData {
    return {
        series: series.map((points, i) => ({ symbol: `T${i}`, points })),
        start: NOW - 7 * DAY,
        end: NOW,
    };
}

function layout(data: PriceChartData): PriceChartLayout {
    const laidOut = priceChartLayout(data, 700, 100);
    if (laidOut === undefined) throw new Error("Expected a layout");
    return laidOut;
}

describe("a price chart's layout", () => {
    test("runs across the time, highest price at the top, then on flat to the end", () => {
        const chart = layout(week([point(7 * DAY, 1), point(3.5 * DAY, 3), point(DAY, 2)]));

        // 20% of the height is left above and below the line, for the high's and low's labels, and
        // the plot starts right of the gridlines' labels, "$1.00" and so on: 5 characters of 6
        // pixels and a gap of 6
        expect(chart.kind).toBe("usd");
        expect(chart.left).toBe(36);
        expect(chart.lines[0].path).toBe("M36,80L368,20L605.1,50L700,50");
        expect(chart.lines[0].area).toBe("M36,80L368,20L605.1,50L700,50L700,100L36,100Z");
        expect(chart.lines[0].end).toEqual({ x: 700, y: 50 });
        expect(chart.lines[0].rising).toBe(true);
        expect(chart.marks).toEqual([
            { kind: "high", usd: 3, x: 368, y: 20 },
            { kind: "low", usd: 1, x: 36, y: 80 },
        ]);
    });

    test("starts where the first price in its time is", () => {
        const chart = layout(week([point(3.5 * DAY, 3), point(0, 1)]));

        expect(chart.lines[0].path).toBe("M368,20L700,80L700,80");
        expect(chart.lines[0].area).toBe("M368,20L700,80L700,80L700,100L368,100Z");
        expect(chart.lines[0].rising).toBe(false);
    });

    test("leaves out prices from outside its time", () => {
        const chart = layout(week([point(8 * DAY, 9), point(3.5 * DAY, 3), point(0, 1)]));

        expect(chart.lines[0].path).toBe("M368,20L700,80L700,80");
    });

    test("is a flat line across the middle, unmarked, when the price didn't move", () => {
        const chart = layout(week([point(7 * DAY, 2), point(0, 2)]));

        expect(chart.lines[0].path).toBe("M0,50L700,50L700,50");
        expect(chart.lines[0].rising).toBe(true);
        expect(chart.marks).toEqual([]);
    });

    test("is a flat line from a lone price to the end", () => {
        const chart = layout(week([point(3.5 * DAY, 2)]));

        expect(chart.lines[0].path).toBe("M350,50L700,50");
    });

    test("draws several tokens as their change since their first price, without areas or marks", () => {
        // T0 doubles and T1 halves: +100% at the top, -50% at the bottom, 5% of the height left
        const chart = layout(
            week([point(7 * DAY, 1), point(0, 2)], [point(7 * DAY, 4), point(0, 2)]),
        );

        expect(chart.kind).toBe("change");
        expect(chart.lines.map((l) => l.path)).toEqual([
            "M36,65L700,5L700,5",
            "M36,65L700,95L700,95",
        ]);
        expect(chart.lines.map((l) => l.area)).toEqual([undefined, undefined]);
        expect(chart.lines.map((l) => l.rising)).toEqual([true, false]);
        expect(chart.marks).toEqual([]);
    });

    test("has gridlines at round prices, each labelled, at least 28 pixels apart", () => {
        const chart = layout(week([point(7 * DAY, 1), point(3.5 * DAY, 3), point(DAY, 2)]));

        // $1 to $3 over 60 pixels between the 20 left above and below
        expect(chart.gridlines).toEqual([
            { y: 80, label: "$1.00" },
            { y: 50, label: "$2.00" },
            { y: 20, label: "$3.00" },
        ]);
    });

    test("has gridlines at round changes for several tokens", () => {
        const chart = layout(
            week([point(7 * DAY, 1), point(0, 2)], [point(7 * DAY, 4), point(0, 2)]),
        );

        expect(chart.gridlines).toEqual([
            { y: 95, label: "-50%" },
            { y: 65, label: "0%" },
            { y: 35, label: "+50%" },
            { y: 5, label: "+100%" },
        ]);
    });

    test("has no column for labels without gridlines", () => {
        expect(layout(week([point(7 * DAY, 2), point(0, 2)])).left).toBe(0);
    });

    test("has no gridlines when the price didn't move", () => {
        expect(layout(week([point(7 * DAY, 2), point(0, 2)])).gridlines).toEqual([]);
    });

    test("needs a price and a size", () => {
        expect(priceChartLayout(week([]), 700, 100)).toBeUndefined();
        expect(priceChartLayout(week([point(8 * DAY, 2)]), 700, 100)).toBeUndefined();
        expect(priceChartLayout(week([point(0, 2)]), 0, 100)).toBeUndefined();
    });
});

describe("a price chart's high and low", () => {
    const prices = (...usd: number[]) => usd.map((u, i) => point((usd.length - i) * HOUR, u));

    test("are the high's last time and the low's first", () => {
        const points = prices(1, 3, 1, 3, 2);

        expect(extremes(points)).toEqual([
            { kind: "high", point: points[3] },
            { kind: "low", point: points[0] },
        ]);
    });

    test("leave out one that is the latest price", () => {
        const points = prices(1, 3, 2, 3);

        expect(extremes(points)).toEqual([{ kind: "low", point: points[0] }]);
    });

    test("are none when the price didn't move", () => {
        expect(extremes(prices(2, 2))).toEqual([]);
        expect(extremes([])).toEqual([]);
    });
});

describe("a price chart's reading", () => {
    test("snaps to the nearest time with a price", () => {
        const data = week([point(7 * DAY, 1), point(3.5 * DAY, 3), point(DAY, 2)]);

        // nearly 3 days in, right of the labels' 36 pixels, nearest the price 3.5 days in
        expect(readingNear(data, layout(data), 300)).toEqual({
            timestamp: NOW - 3.5 * DAY,
            x: 368,
            values: [{ symbol: "T0", usd: 3, change: 200, y: 20 }],
        });
    });

    test("gives each token's last price by then, leaving out one with none yet", () => {
        const data = week([point(7 * DAY, 1), point(0, 2)], [point(3.5 * DAY, 4), point(0, 2)]);
        const chart = layout(data);

        expect(readingAt(data, chart, NOW - 5 * DAY).values.map((v) => v.symbol)).toEqual(["T0"]);
        expect(readingAt(data, chart, NOW).values).toEqual([
            { symbol: "T0", usd: 2, change: 100, y: 5 },
            { symbol: "T1", usd: 2, change: -50, y: 95 },
        ]);
    });

    test("steps between the times with prices, starting from the latest, and stops at the ends", () => {
        const data = week([point(7 * DAY, 1), point(DAY, 2)], [point(3 * DAY, 4)]);

        expect(stepReading(data, undefined, -1)).toBe(NOW - DAY);
        expect(stepReading(data, NOW - DAY, -1)).toBe(NOW - 3 * DAY);
        expect(stepReading(data, NOW - 3 * DAY, -5)).toBe(NOW - 7 * DAY);
        expect(stepReading(data, NOW - DAY, 1)).toBe(NOW - DAY);
        expect(stepReading(week([]), undefined, 1)).toBeUndefined();
    });

    test("shows the time of day, except over daily prices", () => {
        expect(readingShowsTime({ series: [], start: NOW - 90 * DAY, end: NOW })).toBe(true);
        expect(readingShowsTime({ series: [], start: NOW - 365 * DAY, end: NOW })).toBe(false);
    });

    test("gives one token's price, or each token's symbol, price and change", () => {
        const one = week([point(7 * DAY, 1), point(DAY, 2)]);
        const several = week([point(7 * DAY, 1), point(0, 2)], [point(7 * DAY, 4), point(0, 2)]);
        const severalLayout = layout(several);

        expect(readingValue(layout(one), readingAt(one, layout(one), NOW).values[0])).toBe("$2.00");
        expect(
            readingAt(several, severalLayout, NOW).values.map((v) =>
                readingValue(severalLayout, v),
            ),
        ).toEqual(["T0 $2.00 (+100.0%)", "T1 $2.00 (-50.0%)"]);
    });

    test("reads as its time then its values", () => {
        const data = week([point(7 * DAY, 1), point(DAY, 2)]);
        const text = readingText(data, layout(data), readingAt(data, layout(data), NOW), "en-GB");

        expect(text).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}: \$2\.00$/);
    });

    test("is moved by the arrow, page, home and end keys, and cleared by escape", () => {
        const data = week([point(7 * DAY, 1), point(3 * DAY, 3), point(DAY, 2)]);
        const reader = new PriceChartReader();

        expect(reader.key(data, "ArrowLeft")).toBe(true);
        expect(reader.timestamp).toBe(NOW - DAY);
        reader.key(data, "ArrowLeft");
        expect(reader.timestamp).toBe(NOW - 3 * DAY);
        reader.key(data, "Home");
        expect(reader.timestamp).toBe(NOW - 7 * DAY);
        reader.key(data, "End");
        expect(reader.timestamp).toBe(NOW - DAY);
        expect(reader.key(data, "Escape")).toBe(true);
        expect(reader.timestamp).toBeUndefined();
        expect(reader.key(data, "a")).toBe(false);
    });

    test("is kept by the reader until cleared", () => {
        const data = week([point(7 * DAY, 1), point(DAY, 2)]);
        const reader = new PriceChartReader();

        reader.step(data, 1);
        expect(reader.timestamp).toBe(NOW - DAY);

        reader.pointAt(data, layout(data), 10);
        expect(reader.timestamp).toBe(NOW - 7 * DAY);

        reader.clear();
        expect(reader.timestamp).toBeUndefined();
    });
});

describe("priceChange", () => {
    test("is from the first price to the last, in percent", () => {
        expect(priceChange([point(7 * DAY, 2), point(DAY, 4), point(0, 3)])).toBeCloseTo(50);
        expect(priceChange([point(DAY, 4), point(0, 3)])).toBeCloseTo(-25);
    });

    test("needs two prices", () => {
        expect(priceChange([])).toBeUndefined();
        expect(priceChange([point(0, 3)])).toBeUndefined();
    });
});

describe("a price chart's tokens", () => {
    test("are each token with prices, with its latest price and its change", () => {
        const data = week(
            [point(7 * DAY, 2), point(DAY, 3)],
            [point(8 * DAY, 9)],
            [point(2 * DAY, 4)],
        );

        expect(priceChartTokens(data)).toEqual([
            { series: data.series[0], usd: 3, change: 50 },
            { series: data.series[2], usd: 4, change: undefined },
        ]);
    });
});

describe("a price chart's credit", () => {
    const icpswap = { name: "ICPSwap", url: "https://www.icpswap.com" };
    const coingecko = { name: "CoinGecko", url: "https://www.coingecko.com" };

    test("lists its sources in one sentence, each its own part", () => {
        expect(priceChartCredit("Price data by @@", "@@", [icpswap, coingecko], "en")).toEqual([
            { kind: "text", text: "Price data by " },
            { kind: "source", source: icpswap },
            { kind: "text", text: " and " },
            { kind: "source", source: coingecko },
        ]);
    });

    test("keeps the words on either side of its sources, in the reader's language", () => {
        expect(priceChartCredit("Von @@ geliefert", "@@", [icpswap, coingecko], "de")).toEqual([
            { kind: "text", text: "Von " },
            { kind: "source", source: icpswap },
            { kind: "text", text: " und " },
            { kind: "source", source: coingecko },
            { kind: "text", text: " geliefert" },
        ]);
    });

    test("is nothing without sources, or a sentence to put them in", () => {
        expect(priceChartCredit("Price data by @@", "@@", [], "en")).toEqual([]);
        expect(priceChartCredit("Price data", "@@", [icpswap], "en")).toEqual([]);
    });
});
