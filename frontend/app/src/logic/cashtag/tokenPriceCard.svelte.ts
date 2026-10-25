import type { OpenChat, TokenPricePoint } from "@client";
import type { RemoteData } from "@src/utils/remoteData";

// A token's price card, opened by a cashtag clicked in a message (`<cash-tag>`): its price now, and
// a chart of its price over the last 7 days, loaded as the card opens. The same in every tree.

const SEVEN_DAYS_MILLIS = 7 * 24 * 60 * 60 * 1000;

/** The SVG paths of a price chart: the line through the prices, and the area under it. */
export type PriceChart = {
    line: string;
    area: string;
    // whether the price ended the week at least where it started it
    rising: boolean;
};

/** The change in percent from the first price to the last, with at least two. */
export function priceChange(points: TokenPricePoint[]): number | undefined {
    if (points.length < 2) return undefined;
    return (points[points.length - 1].usd / points[0].usd - 1) * 100;
}

/**
 * A chart `width` by `height` of the prices over the 7 days up to `now`. The line runs on flat from
 * the last price to `now`, since the price is the last trade's until there's another, so a lone price
 * is a flat line. Undefined with no prices.
 */
export function priceChart(
    points: TokenPricePoint[],
    now: number,
    width: number,
    height: number,
): PriceChart | undefined {
    if (points.length === 0) return undefined;

    const start = now - SEVEN_DAYS_MILLIS;
    const prices = points.map((p) => p.usd);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    // a little room above and below, so the line isn't cut by the edges
    const pad = height * 0.05;
    const x = (timestamp: number) =>
        ((Math.min(Math.max(timestamp, start), now) - start) / SEVEN_DAYS_MILLIS) * width;
    const y = (usd: number) =>
        max === min ? height / 2 : pad + ((max - usd) / (max - min)) * (height - 2 * pad);

    const first = points[0];
    const last = points[points.length - 1];
    const coords = [...points, { timestamp: now, usd: last.usd }].map(
        (p) => `${round(x(p.timestamp))},${round(y(p.usd))}`,
    );
    const line = `M${coords.join("L")}`;
    return {
        line,
        area: `${line}L${round(x(now))},${height}L${round(x(first.timestamp))},${height}Z`,
        rising: last.usd >= first.usd,
    };
}

function round(n: number): number {
    return Math.round(n * 10) / 10;
}

/** The card's price history, loading as it opens. */
export class TokenPriceHistory {
    #history: RemoteData<TokenPricePoint[], "unavailable"> = $state({ kind: "loading" });
    // when the history was loaded, which the chart runs up to
    #loadedAt = 0;

    constructor(client: OpenChat, ledger: string) {
        void this.#load(client, ledger);
    }

    get history(): RemoteData<TokenPricePoint[], "unavailable"> {
        return this.#history;
    }

    /** The change over the 7 days, once the history has loaded. */
    get change(): number | undefined {
        return this.#history.kind === "success" ? priceChange(this.#history.data) : undefined;
    }

    /** The chart at the given size, once the history has loaded. */
    chart(width: number, height: number): PriceChart | undefined {
        return this.#history.kind === "success"
            ? priceChart(this.#history.data, this.#loadedAt, width, height)
            : undefined;
    }

    async #load(client: OpenChat, ledger: string): Promise<void> {
        const points = await client.getTokenPriceHistory(ledger);
        // not before the last price, so a device whose clock is slow doesn't squash the last hours
        this.#loadedAt = Math.max(Date.now(), points?.at(-1)?.timestamp ?? 0);
        this.#history =
            points !== undefined
                ? { kind: "success", data: points }
                : { kind: "error", error: "unavailable" };
    }
}
