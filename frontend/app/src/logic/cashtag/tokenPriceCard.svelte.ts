import type {
    CashtagCoin,
    CryptocurrencyDetails,
    OpenChat,
    PriceHistory,
    PriceSubject,
    ReadonlyMap,
    TokenExchangeRates,
    TokenPricePoint,
} from "@client";
import type { PriceChartData } from "@src/logic/priceChart/priceChart.svelte";
import type { RemoteData } from "@src/utils/remoteData";

// A token's or coin's price card, opened by a cashtag clicked in a message (`<cash-tag>`): its
// price now, and a chart of its price over the last 7 days (logic/priceChart), loaded as the card
// opens. The same in every tree.

const SEVEN_DAYS_MILLIS = 7 * 24 * 60 * 60 * 1000;

/** What a card shows of its token or coin, besides the chart. */
export type CashtagCardDetails = {
    name: string;
    symbol: string;
    // a coin OpenChat doesn't list has none
    logo: string | undefined;
    usd: number | undefined;
    // where `usd` is from, a key of the price sources
    source: string | undefined;
};

/** The card's token, from the Registry's tokens and their prices, or coin. Undefined if it's gone. */
export function cashtagCardDetails(
    subject: PriceSubject,
    tokens: ReadonlyMap<string, CryptocurrencyDetails>,
    exchangeRates: ReadonlyMap<string, TokenExchangeRates>,
    coins: ReadonlyMap<string, CashtagCoin>,
): CashtagCardDetails | undefined {
    if (subject.kind === "token") {
        const token = tokens.get(subject.ledger);
        if (token === undefined) return undefined;
        const rate = exchangeRates.get(subject.ledger);
        return {
            name: token.name,
            symbol: token.symbol,
            logo: token.logo,
            usd: rate?.toUSD,
            source: rate?.source,
        };
    }
    const coin = [...coins.values()].find((c) => c.id === subject.id);
    return coin === undefined
        ? undefined
        : {
              name: coin.name,
              symbol: coin.symbol,
              logo: undefined,
              usd: coin.usd,
              source: coin.source,
          };
}

/**
 * Remembers the last details a card had, for when its token or coin drops out of the prices (the
 * price service leaves out coins it hasn't refreshed for an hour): the card stays as it was, rather
 * than vanishing and coming back unasked once the coin returns.
 */
export function lastCardDetails(): (
    details: CashtagCardDetails | undefined,
) => CashtagCardDetails | undefined {
    let last: CashtagCardDetails | undefined;
    return (details) => (last = details ?? last);
}

/** The change in percent from the first price to the last, with at least two. */
export function priceChange(points: TokenPricePoint[]): number | undefined {
    if (points.length < 2) return undefined;
    return (points[points.length - 1].usd / points[0].usd - 1) * 100;
}

/** The card's price history, loading as it opens. */
export class TokenPriceHistory {
    #history: RemoteData<PriceHistory, "unavailable"> = $state({ kind: "loading" });
    // when the history was loaded, which the chart runs up to
    #loadedAt = 0;

    constructor(client: OpenChat, subject: PriceSubject) {
        void this.#load(client, subject);
    }

    get history(): RemoteData<PriceHistory, "unavailable"> {
        return this.#history;
    }

    /** Where the history's prices are from, once it has loaded. */
    get source(): string | undefined {
        return this.#history.kind === "success" ? this.#history.data.source : undefined;
    }

    /** The change over the 7 days, once the history has loaded. */
    get change(): number | undefined {
        return this.#history.kind === "success"
            ? priceChange(this.#history.data.points)
            : undefined;
    }

    /**
     * The chart of the 7 days up to when the history loaded, once it has. Its line runs on flat from
     * the last price to then, since the price is the last trade's until there's another.
     */
    chartData(symbol: string): PriceChartData | undefined {
        return this.#history.kind === "success"
            ? {
                  series: [{ symbol, points: this.#history.data.points }],
                  start: this.#loadedAt - SEVEN_DAYS_MILLIS,
                  end: this.#loadedAt,
              }
            : undefined;
    }

    async #load(client: OpenChat, subject: PriceSubject): Promise<void> {
        const history = await client.getPriceHistory(subject);
        // not before the last price, so a device whose clock is slow doesn't squash the last hours
        this.#loadedAt = Math.max(Date.now(), history?.points.at(-1)?.timestamp ?? 0);
        this.#history =
            history !== undefined
                ? { kind: "success", data: history }
                : { kind: "error", error: "unavailable" };
    }
}
