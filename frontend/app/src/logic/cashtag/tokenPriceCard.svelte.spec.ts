import type {
    CashtagCoin,
    CryptocurrencyDetails,
    OpenChat,
    PriceSubject,
    TokenPricePoint,
} from "@client";
import {
    cashtagCardDetails,
    priceChange,
    priceChart,
    TokenPriceHistory,
} from "./tokenPriceCard.svelte";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_792_926_499_000;

function point(ago: number, usd: number): TokenPricePoint {
    return { timestamp: NOW - ago, usd };
}

const LEDGER: PriceSubject = { kind: "token", ledger: "ledger-1" };

function client(points: TokenPricePoint[] | undefined, source?: string) {
    return {
        getPriceHistory: vi.fn(async () => (points !== undefined ? { points, source } : undefined)),
    } as never as OpenChat & { getPriceHistory: ReturnType<typeof vi.fn> };
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

    test("is a flat line from a lone price to now", () => {
        const chart = priceChart([point(3.5 * DAY, 2)], NOW, 700, 100);

        expect(chart?.line).toBe("M350,50L700,50");
    });

    test("needs a price", () => {
        expect(priceChart([], NOW, 700, 100)).toBeUndefined();
    });
});

describe("a token price card's history", () => {
    test("loads the token's history as the card opens", async () => {
        const c = client([point(DAY, 2), point(0, 3)], "icpswap");
        const history = new TokenPriceHistory(c, LEDGER);

        expect(history.history.kind).toBe("loading");
        expect(history.change).toBeUndefined();
        expect(history.chart(700, 100)).toBeUndefined();

        await settle();

        expect(c.getPriceHistory).toHaveBeenCalledWith(LEDGER);
        expect(history.history.kind).toBe("success");
        expect(history.source).toBe("icpswap");
        expect(history.change).toBeCloseTo(50);
        expect(history.chart(700, 100)?.rising).toBe(true);
    });

    test("runs its chart to the last price when the device's clock is behind it", async () => {
        const now = vi.spyOn(Date, "now").mockReturnValue(NOW - 2 * HOUR);
        const history = new TokenPriceHistory(client([point(DAY, 2), point(0, 3)]), LEDGER);
        await settle();
        now.mockRestore();

        // the last price at the right edge, not squashed onto it from two hours on
        expect(history.chart(700, 100)?.line).toBe("M600,95L700,5L700,5");
    });

    test("is unavailable when it can't be loaded", async () => {
        const history = new TokenPriceHistory(client(undefined), LEDGER);
        await settle();

        expect(history.history).toEqual({ kind: "error", error: "unavailable" });
        expect(history.chart(700, 100)).toBeUndefined();
    });
});

describe("a price card's token or coin", () => {
    const chat = { name: "OpenChat", symbol: "CHAT", logo: "chat.svg" } as CryptocurrencyDetails;
    const ada: CashtagCoin = {
        id: "cardano",
        symbol: "ADA",
        name: "Cardano",
        usd: 0.205,
        source: "coingecko",
    };
    const tokens = new Map([["chat-ledger", chat]]);
    const rates = new Map([["chat-ledger", { toUSD: 0.0281, source: "icpswap" }]]);
    const coins = new Map([["ada", ada]]);

    test("is a token OpenChat lists, with its logo and price", () => {
        expect(
            cashtagCardDetails({ kind: "token", ledger: "chat-ledger" }, tokens, rates, coins),
        ).toEqual({
            name: "OpenChat",
            symbol: "CHAT",
            logo: "chat.svg",
            usd: 0.0281,
            source: "icpswap",
        });
    });

    test("is a coin it doesn't, by its id, with no logo", () => {
        expect(cashtagCardDetails({ kind: "coin", id: "cardano" }, tokens, rates, coins)).toEqual({
            name: "Cardano",
            symbol: "ADA",
            logo: undefined,
            usd: 0.205,
            source: "coingecko",
        });
    });

    test("is undefined once its token or coin is gone", () => {
        expect(cashtagCardDetails({ kind: "coin", id: "dud" }, tokens, rates, coins)).toBeUndefined();
        expect(
            cashtagCardDetails({ kind: "token", ledger: "gone" }, tokens, rates, coins),
        ).toBeUndefined();
    });
});
