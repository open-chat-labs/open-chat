// The Wallet tab's root and a token's page (native design notes §3.9, §4; the native plan's 13) as
// the screens draw them. The figures are the web wallet's (lib/wallet: the holdings, the total,
// the display currency; logic/wallet/walletTokens: the tokens and their activity), so both wallets
// agree; only the native layout's choices are made here.
import type { WalletActivity, WalletPanelSettings, WalletToken } from "@openchat/ui/src/lib/types";
import {
    activityAmount,
    activityDay,
    activityTime,
    currencyRates,
    displayCurrencies,
    formatHolding,
    formatMoney,
    formatShare,
    formatSmallHolding,
    formatTokenAmount,
    formatUnitPrice,
    groupByDay,
    inActivityFilter,
    nextCurrency,
    shareOf,
    tokenMenuFlows,
    tokenPageActions,
    VEILED,
    walletHoldings,
    walletTokenId,
    type TokenFlow,
} from "@openchat/ui/src/lib/wallet";
import { totalsByCurrency } from "@src/logic/wallet/totalSnapshots";

/** How many supported tokens an empty wallet lists before View all (the prototype's five). */
export const SUPPORTED_SHOWN = 5;

/** The words the screens need, translated (`$_`). */
export type WalletWords = {
    today: (change: string) => string;
    tokens: (count: number) => string;
    smallBalances: (count: number) => string;
    smallSub: (floor: string) => string;
    receivedFrom: (name: string) => string;
    sentTo: (name: string) => string;
    betweenWallets: string;
    todayDay: string;
    yesterdayDay: string;
};

/** What the wallet's figures are worked out from. */
export type WalletFigures = {
    /** The catalogue (walletCatalogue): every token it can receive or holds. */
    tokens: WalletToken[];
    settings: WalletPanelSettings;
    /** USD per unit of BTC, ETH and ICP, from the app's exchange rates. */
    rates: Partial<Record<string, number>>;
    /** The ledger each display currency is priced by (ICP's, ckBTC's, ckETH's): its token has no price pill. */
    currencyLedgers: Partial<Record<string, string>>;
    currency: string;
    /** Balances hidden (the eye). */
    veiled: boolean;
    locale: string;
};

/**
 * The figures from the app's stores: the display currencies priced by the app's exchange rates on
 * their conversion ledgers (as the web panel prices them), and the wallet's config as the panel
 * reads it.
 */
export function walletFigures(
    tokens: WalletToken[],
    settings: WalletPanelSettings,
    ledgers: { icp: string; btc: string; eth: string },
    rates: { get(ledger: string): { toUSD: number | undefined } | undefined },
    view: { currency: string; veiled: boolean; locale: string },
): WalletFigures {
    return {
        tokens,
        settings,
        rates: {
            ICP: rates.get(ledgers.icp)?.toUSD,
            BTC: rates.get(ledgers.btc)?.toUSD,
            ETH: rates.get(ledgers.eth)?.toUSD,
        },
        currencyLedgers: { ICP: ledgers.icp, BTC: ledgers.btc, ETH: ledgers.eth },
        ...view,
    };
}

/** A token as the root lists it: symbol and price pill over its name, amount over value, share bar. */
export type TokenRow = {
    id: string;
    symbol: string;
    name: string;
    mark: string;
    grad: string;
    logo: string | undefined;
    /** Its price in the display currency; none on the token that is the display currency. */
    price: string | undefined;
    amount: string;
    value: string;
    /** Percent of the total (ShareBar's). */
    share: number;
};

export type SmallRow = Omit<TokenRow, "name" | "price" | "share">;

export type SupportedRow = Pick<TokenRow, "id" | "symbol" | "name" | "mark" | "grad" | "logo"> & {
    price: string;
};

export type TodayPill = { label: string; tone: "success" | "danger" | "neutral" };

/** The root: an empty wallet (nothing owned, once the balances are in), or one with tokens. */
export type WalletRoot =
    | {
          kind: "empty";
          total: string;
          /** The first few supported tokens, and how many there are (View all · N). */
          supported: SupportedRow[];
          supportedCount: number;
      }
    | {
          kind: "funded";
          total: string;
          /** The total's change today; none until there's a snapshot from 24 hours ago. */
          today: TodayPill | undefined;
          /** "4 tokens". */
          count: string;
          tokens: TokenRow[];
          /** The small balances' row: none without any. */
          small: { title: string; sub: string; total: string; rows: SmallRow[] } | undefined;
          supportedCount: number;
      };

const money = (f: WalletFigures, rates: Record<string, number>, usd: number) =>
    f.veiled ? VEILED : formatMoney(usd, f.currency, rates, f.locale);

/** The total's change as its pill reads it: "+1.8% today", green up, red down. */
export function todayPill(
    change: number | undefined,
    locale: string,
    words: Pick<WalletWords, "today">,
): TodayPill | undefined {
    if (change === undefined || !Number.isFinite(change)) return undefined;
    const pct = new Intl.NumberFormat(locale, {
        style: "percent",
        signDisplay: "exceptZero",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(change);
    return {
        label: words.today(pct),
        tone: change > 0.0005 ? "success" : change < -0.0005 ? "danger" : "neutral",
    };
}

/**
 * The root's figures. While the balances are still coming it isn't the empty wallet yet (it
 * would flash before them), as WalletPanel. Tokens are listed largest first. CHIT never shows:
 * it isn't in the catalogue.
 */
export function walletRoot(
    f: WalletFigures,
    state: { balancesLoading: boolean; change: number | undefined; supportedCount: number },
    words: WalletWords,
): WalletRoot {
    const rates = currencyRates(f.tokens, f.rates);
    const h = walletHoldings(f.tokens, f.settings);
    const total = money(f, rates, h.total);
    const empty = !state.balancesLoading && f.tokens.every((t) => !(t.held > 0));
    const face = (t: WalletToken) => ({
        id: walletTokenId(t),
        symbol: t.symbol,
        mark: t.mark,
        grad: t.grad,
        logo: t.logo,
    });
    if (empty) {
        return {
            kind: "empty",
            total,
            supported: f.tokens.slice(0, SUPPORTED_SHOWN).map((t) => ({
                ...face(t),
                name: t.name,
                price: formatUnitPrice(t.price, f.currency, rates, f.locale),
            })),
            supportedCount: state.supportedCount,
        };
    }
    const tokens = h.held
        .slice()
        .sort((a, b) => b.value - a.value)
        .map(
            (t): TokenRow => ({
                ...face(t),
                name: t.name,
                price:
                    f.currencyLedgers[f.currency] === walletTokenId(t)
                        ? undefined
                        : formatUnitPrice(t.price, f.currency, rates, f.locale),
                amount: f.veiled ? VEILED : formatHolding(t.held, f.locale),
                value: money(f, rates, t.value),
                share: shareOf(t.value, h.total),
            }),
        );
    return {
        kind: "funded",
        total,
        today: f.veiled ? undefined : todayPill(state.change, f.locale, words),
        count: words.tokens(h.held.length),
        tokens,
        small:
            h.small.length === 0
                ? undefined
                : {
                      title: words.smallBalances(h.small.length),
                      sub: words.smallSub(formatMoney(h.floor, f.currency, rates, f.locale)),
                      total: money(f, rates, h.smallTotal),
                      rows: h.small.map((t) => ({
                          ...face(t),
                          amount: f.veiled ? VEILED : formatSmallHolding(t.held, f.locale),
                          value: money(f, rates, t.value),
                      })),
                  },
        supportedCount: state.supportedCount,
    };
}

/** A token page's button: its flow, whether it leads, and whether it waits for funds. */
export type TokenAction = { flow: TokenFlow; primary: boolean; disabled: boolean };

/** A token's page: its header, balance, share of the wallet, buttons and menu. */
export type TokenPage = {
    id: string;
    symbol: string;
    name: string;
    mark: string;
    grad: string;
    logo: string | undefined;
    ledger: string | undefined;
    /** The header's price pill: none on the token that is the display currency. */
    price: string | undefined;
    amount: string;
    value: string;
    /** Its share of the wallet, when it's held. */
    share: { label: string; percent: number } | undefined;
    held: boolean;
    /** Send / Receive / Swap: at zero, Receive first and the others disabled. */
    actions: TokenAction[];
    /** The kebab's flows (then Copy ledger ID, when it has a ledger). */
    menu: TokenFlow[];
};

/**
 * The page of the token `id` names, from the catalogue (a token not held still gets its page, at
 * zero). Undefined for one the catalogue doesn't have. A flow the token doesn't offer
 * (tokenActions: swapping a token no exchange lists) is left out of the menu and its button
 * disabled.
 */
export function tokenPage(f: WalletFigures, id: string): TokenPage | undefined {
    const t = f.tokens.find((x) => walletTokenId(x) === id);
    if (t === undefined) return undefined;
    const rates = currencyRates(f.tokens, f.rates);
    // its share of everything owned, as the web's token page (WalletMain) divides it: a manual
    // wallet's total counts only its list, and a held token off the list still has a page here
    const owned = walletHoldings(f.tokens, f.settings).owned.reduce((n, x) => n + x.value, 0);
    const value = t.price * t.held;
    const held = t.held > 0;
    const offers = (flow: TokenFlow) => !t.actions || t.actions.includes(flow);
    return {
        id,
        symbol: t.symbol,
        name: t.name,
        mark: t.mark,
        grad: t.grad,
        logo: t.logo,
        ledger: t.ledger,
        price:
            f.currencyLedgers[f.currency] === id
                ? undefined
                : formatUnitPrice(t.price, f.currency, rates, f.locale),
        amount: f.veiled ? VEILED : formatTokenAmount(t.held, t.dp, f.locale),
        value: money(f, rates, value),
        share: held
            ? {
                  label: f.veiled ? VEILED : formatShare(value, owned),
                  percent: shareOf(value, owned),
              }
            : undefined,
        held,
        actions: tokenPageActions(held).map((a) => ({
            flow: a.target,
            primary: a.primary,
            disabled: a.disabled || !offers(a.target),
        })),
        menu: tokenMenuFlows(held, offers),
    };
}

/** An activity row on a token's page (TransactionRow's). */
export type ActivityRow = {
    id: string;
    title: string;
    sub: string;
    amount: string;
    fiat: string;
    kind: WalletActivity["kind"];
    positive: boolean;
    divider: boolean;
};

/** The filter tabs: All, Sent, Received, Swaps (0–3, lib/wallet's `inActivityFilter`). */
export type ActivityFilter = 0 | 1 | 2 | 3;

/**
 * A token's activity under a filter tab, newest first, in day groups ("TODAY", "YESTERDAY",
 * "12 NOV"), each row's value in the display currency.
 */
export function tokenActivityGroups(
    activity: WalletActivity[],
    token: Pick<WalletToken, "symbol" | "dp"> & { id: string },
    filter: ActivityFilter,
    f: Pick<WalletFigures, "tokens" | "rates" | "currency" | "locale">,
    words: Pick<
        WalletWords,
        "receivedFrom" | "sentTo" | "betweenWallets" | "todayDay" | "yesterdayDay"
    >,
    now: number = Date.now(),
): { label: string; rows: ActivityRow[] }[] {
    const rates = currencyRates(f.tokens, f.rates);
    const rows = activity
        .filter((a) => (a.token ?? a.symbol) === token.id && inActivityFilter(a.kind, filter))
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((a) => ({
            day: activityDay(a.timestamp, f.locale, now),
            row: {
                id: a.id,
                title:
                    a.title ??
                    (a.kind === "own"
                        ? words.betweenWallets
                        : a.kind === "receive"
                          ? words.receivedFrom(a.party ?? "")
                          : words.sentTo(a.party ?? "")),
                sub: [activityTime(a.timestamp, f.locale), a.context].filter(Boolean).join(" · "),
                amount: activityAmount(a.kind, a.amount, token.dp, token.symbol, f.locale),
                fiat: formatMoney(a.fiat, f.currency, rates, f.locale),
                kind: a.kind,
                positive: a.kind === "receive",
                divider: false,
            },
        }));
    return groupByDay(rows).map((g) => ({
        label: (g.day === "today"
            ? words.todayDay
            : g.day === "yesterday"
              ? words.yesterdayDay
              : g.day
        ).toUpperCase(),
        rows: g.items.map((x, i) => ({ ...x.row, divider: i > 0 })),
    }));
}

/** The display currency a tap on the total moves to: the next one the rates price. */
export function nextDisplayCurrency(
    f: Pick<WalletFigures, "tokens" | "rates" | "currency">,
): string {
    return nextCurrency(f.currency, displayCurrencies(currencyRates(f.tokens, f.rates)));
}

/** The total listed (WalletPanel's), in USD and in every display currency priced, for the snapshots. */
export function walletTotals(
    f: Pick<WalletFigures, "tokens" | "rates" | "settings">,
): Record<string, number> {
    return totalsByCurrency(
        walletHoldings(f.tokens, f.settings).total,
        currencyRates(f.tokens, f.rates),
    );
}

/** A row of the Supported tokens sheet: a token held shows its amount and value, any other its price. */
export type SheetRow = Pick<TokenRow, "id" | "symbol" | "name" | "mark" | "grad" | "logo"> & {
    right: string;
    rightSub: string | undefined;
};

/**
 * The Supported tokens sheet: the tokens held ("Your tokens"), then the rest of the catalogue ("All
 * tokens"), those whose symbol or name has the search in it. A flow's token sheet lists only the
 * tokens it can take (`offered`, by id: Send's held ones, Swap's payable ones or its targets).
 */
export function supportedSheet(
    f: WalletFigures,
    query: string,
    offered?: (id: string) => boolean,
): { yours: SheetRow[]; others: SheetRow[] } {
    const rates = currencyRates(f.tokens, f.rates);
    const needle = query.trim().toLowerCase();
    const shown = f.tokens.filter(
        (t) =>
            (offered === undefined || offered(walletTokenId(t))) &&
            (needle === "" || `${t.symbol} ${t.name}`.toLowerCase().includes(needle)),
    );
    const row = (t: WalletToken, held: boolean): SheetRow => ({
        id: walletTokenId(t),
        symbol: t.symbol,
        name: t.name,
        mark: t.mark,
        grad: t.grad,
        logo: t.logo,
        right: held
            ? f.veiled
                ? VEILED
                : formatHolding(t.held, f.locale)
            : formatUnitPrice(t.price, f.currency, rates, f.locale),
        rightSub: held ? money(f, rates, t.price * t.held) : undefined,
    });
    return {
        yours: shown.filter((t) => t.held > 0).map((t) => row(t, true)),
        others: shown.filter((t) => !(t.held > 0)).map((t) => row(t, false)),
    };
}

/** Where a flow opens: over the token's page with it filled (?token=), or over the wallet. */
export function flowUrl(flow: TokenFlow, ledger?: string): string {
    return ledger === undefined
        ? `/wallet/${flow}`
        : `/wallet/${flow}?token=${encodeURIComponent(ledger)}`;
}

/** A token's page. */
export function tokenUrl(id: string): string {
    return `/wallet/${encodeURIComponent(id)}`;
}
