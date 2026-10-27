import {
    formatPercentChange,
    formatUsdPrice,
    toDateString,
    toDatetimeString,
    type TokenPricePoint,
} from "@client";

// A chart of token prices which the reader can explore: hovering over it, or pressing and dragging
// along it, shows the prices at that time. One token's prices are drawn in USD, with its high and
// low marked; several tokens' as their change since the chart's start. Used by the cashtag price
// card and by price chart messages, in every tree.

const DAY = 24 * 60 * 60 * 1000;
// Beyond this, prices are daily, so a reading shows the date but no time
const LONGEST_WITH_TIMES = 90 * DAY;
// Room above and below the line, for the high's and low's labels, as a share of the height
const MARKED_PAD = 0.2;
const PAD = 0.05;
// The least room between gridlines, in pixels, so their labels don't crowd
const GRIDLINE_SPACING = 28;
// The gridlines' labels are in a column left of the plot: about this wide for each character,
// with this gap between them and the plot, in pixels
const LABEL_CHAR_WIDTH = 6;
const LABEL_GAP = 6;

/**
 * The colours of several tokens' lines, in order: ChartBot's, so a chart message looks as its
 * image did. Each colour is told apart from the next for colour blind readers (CVD ΔE at least 8)
 * and stands out from light and dark backgrounds (3:1), as checked by the dataviz palette
 * validator. Lines don't need every pair told apart, only neighbours, and each line is also named
 * in the chart's legend and readings.
 */
export const PRICE_CHART_COLOURS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] as const;

/** One token's prices, oldest first */
export type PriceSeries = {
    symbol: string;
    points: TokenPricePoint[];
};

/** What a chart draws: its tokens' prices from `start` to `end` */
export type PriceChartData = {
    series: PriceSeries[];
    start: number;
    end: number;
};

/** A chart laid out at a size in pixels */
export type PriceChartLayout = {
    // one token's prices are drawn in USD, several tokens' as their change in percent
    kind: "usd" | "change";
    width: number;
    height: number;
    // where the plot starts, right of the gridlines' labels
    left: number;
    lines: PriceChartLine[];
    // the high and low of one token's prices, unless one is its latest price
    marks: PriceChartMark[];
    // across the chart at round prices, or changes, each labelled with its value
    gridlines: PriceChartGridline[];
};

export type PriceChartGridline = {
    y: number;
    // eg. "$0.03", or "+10%"
    label: string;
};

export type PriceChartLine = {
    symbol: string;
    // the SVG path through the prices, running on flat from the last to the chart's end
    path: string;
    // the area under the line, drawn only for one token
    area: string | undefined;
    // where the line ends, at the latest price
    end: ChartPoint;
    rising: boolean;
};

export type ChartPoint = { x: number; y: number };

export type PriceChartMark = ChartPoint & {
    kind: "high" | "low";
    usd: number;
};

/** The prices at a time the reader has picked */
export type PriceChartReading = {
    timestamp: number;
    x: number;
    // each token with a price by then, in the chart's order
    values: PriceChartValue[];
};

export type PriceChartValue = {
    symbol: string;
    usd: number;
    // since the token's first price on the chart, in percent
    change: number;
    y: number;
};

/** A token's latest price on a chart, and its change since its first, for the chart's legend */
export type PriceChartToken<S extends PriceSeries = PriceSeries> = {
    series: S;
    usd: number;
    // undefined with a lone price
    change: number | undefined;
};

/** The change in percent from the first price to the last, with at least two. */
export function priceChange(points: TokenPricePoint[]): number | undefined {
    if (points.length < 2) return undefined;
    return (points[points.length - 1].usd / points[0].usd - 1) * 100;
}

/**
 * Each token with prices on the chart, in the order of its lines, with its latest price and change.
 * Its series is the one it was given, so a legend keeps whatever else it knows of the token.
 */
export function priceChartTokens<S extends PriceSeries>(data: {
    series: S[];
    start: number;
    end: number;
}): PriceChartToken<S>[] {
    return data.series.flatMap((series) => {
        const points = within(data, series.points);
        return points.length === 0
            ? []
            : [{ series, usd: points[points.length - 1].usd, change: priceChange(points) }];
    });
}

/** The chart at `width` by `height`. Undefined if it has no prices to draw. */
export function priceChartLayout(
    data: PriceChartData,
    width: number,
    height: number,
): PriceChartLayout | undefined {
    const series = drawable(data);
    if (series.length === 0 || width <= 0 || height <= 0) return undefined;

    const kind = series.length === 1 ? "usd" : "change";
    const grid = gridlines(series, kind, height);
    const left =
        grid.length === 0
            ? 0
            : Math.max(...grid.map((g) => g.label.length)) * LABEL_CHAR_WIDTH + LABEL_GAP;
    const x = xScale(data, left, width);
    const y = yScale(series, kind, height);

    const lines = series.map((s): PriceChartLine => {
        const first = s.points[0];
        const last = s.points[s.points.length - 1];
        const at = (p: TokenPricePoint): ChartPoint => ({
            x: round(x(p.timestamp)),
            y: round(y(value(kind, s, p.usd))),
        });
        const coords = [...s.points, { timestamp: data.end, usd: last.usd }].map(at);
        const path = `M${coords.map((c) => `${c.x},${c.y}`).join("L")}`;
        const end = coords[coords.length - 1];
        return {
            symbol: s.symbol,
            path,
            area:
                kind === "usd" ? `${path}L${end.x},${height}L${coords[0].x},${height}Z` : undefined,
            end,
            rising: last.usd >= first.usd,
        };
    });

    const marks =
        kind === "usd"
            ? extremes(series[0].points).map(
                  (m): PriceChartMark => ({
                      kind: m.kind,
                      usd: m.point.usd,
                      x: round(x(m.point.timestamp)),
                      y: round(y(m.point.usd)),
                  }),
              )
            : [];

    return { kind, width, height, left, lines, marks, gridlines: grid };
}

/**
 * The high (its last time) and the low (its first time) of the prices, leaving out one that is
 * also the latest price, which the line's end shows, and both if the prices never moved.
 */
export function extremes(
    points: TokenPricePoint[],
): { kind: "high" | "low"; point: TokenPricePoint }[] {
    if (points.length === 0) return [];
    let high = points[0];
    let low = points[0];
    for (const p of points) {
        if (p.usd >= high.usd) high = p;
        if (p.usd < low.usd) low = p;
    }
    if (high.usd === low.usd) return [];
    const latest = points[points.length - 1].usd;
    return [
        { kind: "high" as const, point: high },
        { kind: "low" as const, point: low },
    ].filter((m) => m.point.usd !== latest);
}

/**
 * The prices at the time nearest `x`, snapped to the nearest time any token has a price. Undefined
 * if the chart has no prices.
 */
export function readingNear(
    data: PriceChartData,
    layout: PriceChartLayout,
    x: number,
): PriceChartReading | undefined {
    const time =
        data.start + ((x - layout.left) / (layout.width - layout.left)) * (data.end - data.start);
    const times = priceTimes(data);
    if (times.length === 0) return undefined;
    const nearest = times.reduce((best, t) =>
        Math.abs(t - time) < Math.abs(best - time) ? t : best,
    );
    return readingAt(data, layout, nearest);
}

/** The prices at `timestamp`: each token's last price by then. */
export function readingAt(
    data: PriceChartData,
    layout: PriceChartLayout,
    timestamp: number,
): PriceChartReading {
    const series = drawable(data);
    const y = yScale(series, layout.kind, layout.height);
    return {
        timestamp,
        x: round(xScale(data, layout.left, layout.width)(timestamp)),
        values: series.flatMap((s): PriceChartValue[] => {
            const point = s.points.findLast((p) => p.timestamp <= timestamp);
            if (point === undefined) return [];
            const change = (point.usd / s.points[0].usd - 1) * 100;
            return [
                {
                    symbol: s.symbol,
                    usd: point.usd,
                    change,
                    y: round(y(layout.kind === "usd" ? point.usd : change)),
                },
            ];
        }),
    };
}

/**
 * The time `by` prices on from `timestamp`, among the times any token has a price, for moving the
 * reading with the keyboard. With no reading yet, it starts from the latest price.
 */
export function stepReading(
    data: PriceChartData,
    timestamp: number | undefined,
    by: number,
): number | undefined {
    const times = priceTimes(data);
    if (times.length === 0) return undefined;
    if (timestamp === undefined) return times[times.length - 1];
    const index = times.findIndex((t) => t >= timestamp);
    const from = index === -1 ? times.length - 1 : index;
    return times[Math.min(Math.max(from + by, 0), times.length - 1)];
}

/** Whether a reading shows the time of day, which it doesn't over daily prices. */
export function readingShowsTime(data: PriceChartData): boolean {
    return data.end - data.start <= LONGEST_WITH_TIMES;
}

/** A reading's time, in the reader's own time zone. */
export function readingTime(data: PriceChartData, timestamp: number, locale: string): string {
    const date = new Date(timestamp);
    return readingShowsTime(data) ? toDatetimeString(date, locale) : toDateString(date, locale);
}

/**
 * A token's value in a reading: its price, and with several tokens, its symbol and change, eg.
 * "$0.0312" or "CHAT $0.0312 (+4.1%)".
 */
export function readingValue(layout: PriceChartLayout, value: PriceChartValue): string {
    return layout.kind === "usd"
        ? formatUsdPrice(value.usd)
        : `${value.symbol} ${formatUsdPrice(value.usd)} (${formatPercentChange(value.change)})`;
}

/** A reading as one line of text, for screen readers. */
export function readingText(
    data: PriceChartData,
    layout: PriceChartLayout,
    reading: PriceChartReading,
    locale: string,
): string {
    const values = reading.values.map((v) => readingValue(layout, v)).join(", ");
    return `${readingTime(data, reading.timestamp, locale)}: ${values}`;
}

/** Part of a chart's credit: its words, or one of its sources, which is drawn as a link. */
export type PriceChartCreditPart<S> =
    | { kind: "text"; text: string }
    | { kind: "source"; source: S };

/**
 * A chart's credit, eg. "Price data by ICPSwap and CoinGecko", in parts, so that each source's name
 * can link to it. `sentence` is the translated credit with `marker` where the sources go, and they
 * are listed as the reader's language lists things.
 */
export function priceChartCredit<S extends { name: string }>(
    sentence: string,
    marker: string,
    sources: S[],
    locale: string,
): PriceChartCreditPart<S>[] {
    const at = sentence.indexOf(marker);
    if (at === -1 || sources.length === 0) return [];
    let next = 0;
    const listed = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
        .formatToParts(sources.map((s) => s.name))
        .map(
            (part): PriceChartCreditPart<S> =>
                part.type === "element"
                    ? { kind: "source", source: sources[next++] }
                    : { kind: "text", text: part.value },
        );
    const before = sentence.slice(0, at);
    const after = sentence.slice(at + marker.length);
    return [
        ...(before === "" ? [] : [{ kind: "text" as const, text: before }]),
        ...listed,
        ...(after === "" ? [] : [{ kind: "text" as const, text: after }]),
    ];
}

// How far each key moves the reading, in prices
const KEY_STEPS: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    PageDown: -10,
    PageUp: 10,
    Home: -Infinity,
    End: Infinity,
};

/** The time the reader has picked, if any, kept while they hover, drag or use the keyboard. */
export class PriceChartReader {
    #timestamp: number | undefined = $state();

    get timestamp(): number | undefined {
        return this.#timestamp;
    }

    /** Picks the time nearest `x` pixels across the chart. */
    pointAt(data: PriceChartData, layout: PriceChartLayout, x: number): void {
        this.#timestamp = readingNear(data, layout, x)?.timestamp;
    }

    /** Moves the picked time `by` prices on. */
    step(data: PriceChartData, by: number): void {
        this.#timestamp = stepReading(data, this.#timestamp, by);
    }

    /**
     * Moves the picked time with the arrow, page, home and end keys, and clears it with escape.
     * Returns whether the key was one of those.
     */
    key(data: PriceChartData, key: string): boolean {
        if (key === "Escape") {
            this.clear();
            return true;
        }
        const by = KEY_STEPS[key];
        if (by === undefined) return false;
        this.step(data, by);
        return true;
    }

    clear(): void {
        this.#timestamp = undefined;
    }
}

// The series with prices, each cut to the chart's time
function drawable(data: PriceChartData): PriceSeries[] {
    return data.series
        .map((s) => ({ symbol: s.symbol, points: within(data, s.points) }))
        .filter((s) => s.points.length > 0);
}

function within(
    time: { start: number; end: number },
    points: TokenPricePoint[],
): TokenPricePoint[] {
    return points.filter((p) => p.timestamp >= time.start && p.timestamp <= time.end);
}

function value(kind: PriceChartLayout["kind"], series: PriceSeries, usd: number): number {
    return kind === "usd" ? usd : (usd / series.points[0].usd - 1) * 100;
}

// From the chart's start at `left` to its end at `width`
function xScale(data: PriceChartData, left: number, width: number): (timestamp: number) => number {
    const span = data.end - data.start;
    return (timestamp) =>
        span <= 0
            ? width
            : left +
              ((Math.min(Math.max(timestamp, data.start), data.end) - data.start) / span) *
                  (width - left);
}

// The scale of every series' values, from the highest at the top to the lowest at the bottom
function yScale(
    series: PriceSeries[],
    kind: PriceChartLayout["kind"],
    height: number,
): (v: number) => number {
    const values = series.flatMap((s) => s.points.map((p) => value(kind, s, p.usd)));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = height * (kind === "usd" && max > min ? MARKED_PAD : PAD);
    return (v) => (max === min ? height / 2 : pad + ((max - v) / (max - min)) * (height - 2 * pad));
}

// Lines at round values across the prices' range, as many as fit at least GRIDLINE_SPACING pixels
// apart, none if the prices never moved
function gridlines(
    series: PriceSeries[],
    kind: PriceChartLayout["kind"],
    height: number,
): PriceChartGridline[] {
    const values = series.flatMap((s) => s.points.map((p) => value(kind, s, p.usd)));
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return [];

    const y = yScale(series, kind, height);
    // the pixels the prices' range spans
    const span = y(min) - y(max);
    const step = roundStep((max - min) / Math.max(1, Math.floor(span / GRIDLINE_SPACING)));
    const lines: PriceChartGridline[] = [];
    for (let i = Math.ceil(min / step); i <= Math.floor(max / step); i++) {
        // without the float error of eg. 3 * 0.1
        const v = Number((i * step).toPrecision(12));
        lines.push({ y: round(y(v)), label: gridlineLabel(kind, v, step) });
    }
    return lines;
}

// The smallest round step, 1, 2, 2.5 or 5 times a power of ten, of at least `rough`
function roundStep(rough: number): number {
    const power = 10 ** Math.floor(Math.log10(rough));
    return [1, 2, 2.5, 5].map((m) => m * power).find((s) => s >= rough * (1 - 1e-9)) ?? 10 * power;
}

function gridlineLabel(kind: PriceChartLayout["kind"], v: number, step: number): string {
    if (kind === "usd") return formatUsdPrice(v);
    return (v / 100).toLocaleString("en-US", {
        style: "percent",
        signDisplay: "exceptZero",
        maximumFractionDigits: step < 1 ? 1 : 0,
    });
}

// Every time any token has a price, oldest first
function priceTimes(data: PriceChartData): number[] {
    const times = new Set(drawable(data).flatMap((s) => s.points.map((p) => p.timestamp)));
    return [...times].sort((a, b) => a - b);
}

function round(n: number): number {
    return Math.round(n * 10) / 10;
}
