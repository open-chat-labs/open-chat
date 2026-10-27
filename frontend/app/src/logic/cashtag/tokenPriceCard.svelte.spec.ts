import type {
    CashtagCoin,
    CryptocurrencyDetails,
    OpenChat,
    PriceSubject,
    TokenPricePoint,
} from "@client";
import {
    cashtagCardDetails,
    lastCardDetails,
    priceChange,
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

describe("a token price card's history", () => {
    test("loads the token's history as the card opens", async () => {
        const c = client([point(DAY, 2), point(0, 3)], "icpswap");
        const history = new TokenPriceHistory(c, LEDGER);

        expect(history.history.kind).toBe("loading");
        expect(history.change).toBeUndefined();
        expect(history.chartData("CHAT")).toBeUndefined();

        await settle();

        expect(c.getPriceHistory).toHaveBeenCalledWith(LEDGER);
        expect(history.history.kind).toBe("success");
        expect(history.source).toBe("icpswap");
        expect(history.change).toBeCloseTo(50);
        expect(history.chartData("CHAT")?.series).toEqual([
            { symbol: "CHAT", points: [point(DAY, 2), point(0, 3)] },
        ]);
    });

    test("runs its chart to the last price when the device's clock is behind it", async () => {
        const now = vi.spyOn(Date, "now").mockReturnValue(NOW - 2 * HOUR);
        const history = new TokenPriceHistory(client([point(DAY, 2), point(0, 3)]), LEDGER);
        await settle();
        now.mockRestore();

        // the last price at the right edge, not squashed onto it from two hours on
        expect(history.chartData("CHAT")).toMatchObject({ start: NOW - 7 * DAY, end: NOW });
    });

    test("is unavailable when it can't be loaded", async () => {
        const history = new TokenPriceHistory(client(undefined), LEDGER);
        await settle();

        expect(history.history).toEqual({ kind: "error", error: "unavailable" });
        expect(history.chartData("CHAT")).toBeUndefined();
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
        expect(
            cashtagCardDetails({ kind: "coin", id: "dud" }, tokens, rates, coins),
        ).toBeUndefined();
        expect(
            cashtagCardDetails({ kind: "token", ledger: "gone" }, tokens, rates, coins),
        ).toBeUndefined();
    });
});

describe("a price card's last details", () => {
    test("stay as they were when the token or coin drops out of the prices", () => {
        const known = lastCardDetails();
        const ada = {
            name: "Cardano",
            symbol: "ADA",
            logo: undefined,
            usd: 0.2,
            source: "coingecko",
        };

        expect(known(undefined)).toBeUndefined();
        expect(known(ada)).toBe(ada);
        expect(known(undefined)).toBe(ada);
        expect(known({ ...ada, usd: 0.21 })?.usd).toBe(0.21);
    });
});
