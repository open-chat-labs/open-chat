import type { OpenChat, TokenPricePoint } from "@client";
import { priceChange, priceChart, TokenPriceHistory } from "./tokenPriceCard.svelte";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_792_926_499_000;

function point(ago: number, usd: number): TokenPricePoint {
    return { timestamp: NOW - ago, usd };
}

function client(history: TokenPricePoint[] | undefined) {
    return {
        getTokenPriceHistory: vi.fn(async () => history),
    } as never as OpenChat & { getTokenPriceHistory: ReturnType<typeof vi.fn> };
}

async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

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

describe("priceChart", () => {
    test("runs across the 7 days, highest price at the top, then on flat to now", () => {
        const chart = priceChart(
            [point(7 * DAY, 1), point(3.5 * DAY, 3), point(DAY, 2)],
            NOW,
            700,
            100,
        );

        // 5% of the height is left above and below the line
        expect(chart?.line).toBe("M0,95L350,5L600,50L700,50");
        expect(chart?.area).toBe("M0,95L350,5L600,50L700,50L700,100L0,100Z");
        expect(chart?.rising).toBe(true);
    });

    test("starts where the first price in the week is", () => {
        const chart = priceChart([point(3.5 * DAY, 3), point(0, 1)], NOW, 700, 100);

        expect(chart?.line).toBe("M350,5L700,95L700,95");
        expect(chart?.area).toBe("M350,5L700,95L700,95L700,100L350,100Z");
        expect(chart?.rising).toBe(false);
    });

    test("is a flat line across the middle when the price didn't move", () => {
        const chart = priceChart([point(7 * DAY, 2), point(0, 2)], NOW, 700, 100);

        expect(chart?.line).toBe("M0,50L700,50L700,50");
        expect(chart?.rising).toBe(true);
    });

    test("needs two prices", () => {
        expect(priceChart([point(0, 2)], NOW, 700, 100)).toBeUndefined();
    });
});

describe("a token price card's history", () => {
    test("loads the token's history as the card opens", async () => {
        const c = client([point(DAY, 2), point(0, 3)]);
        const history = new TokenPriceHistory(c, "ledger-1");

        expect(history.history.kind).toBe("loading");
        expect(history.change).toBeUndefined();
        expect(history.chart(700, 100)).toBeUndefined();

        await settle();

        expect(c.getTokenPriceHistory).toHaveBeenCalledWith("ledger-1");
        expect(history.history.kind).toBe("success");
        expect(history.change).toBeCloseTo(50);
        expect(history.chart(700, 100)?.rising).toBe(true);
    });

    test("is unavailable when it can't be loaded", async () => {
        const history = new TokenPriceHistory(client(undefined), "ledger-1");
        await settle();

        expect(history.history).toEqual({ kind: "error", error: "unavailable" });
        expect(history.chart(700, 100)).toBeUndefined();
    });
});
