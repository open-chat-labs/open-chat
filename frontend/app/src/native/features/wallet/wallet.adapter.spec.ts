import type { WalletActivity, WalletToken } from "@openchat/ui/src/lib/types";
import { describe, expect, test } from "vitest";
import {
    flowUrl,
    nextDisplayCurrency,
    supportedSheet,
    todayPill,
    walletTotals,
    tokenActivityGroups,
    tokenPage,
    tokenUrl,
    walletRoot,
    type WalletFigures,
    type WalletWords,
} from "./wallet.adapter";

const tok = (
    symbol: string,
    held: number,
    price: number,
    over: Partial<WalletToken> = {},
): WalletToken => ({
    id: `${symbol.toLowerCase()}-ledger`,
    symbol,
    name: `${symbol} token`,
    mark: symbol[0],
    grad: "g",
    held,
    price,
    dp: 4,
    ledger: `${symbol.toLowerCase()}-ledger`,
    ...over,
});

const words: WalletWords = {
    today: (c) => `${c} today`,
    tokens: (n) => `${n} tokens`,
    smallBalances: (n) => `${n} small balances`,
    smallSub: (floor) => `Under ${floor} each`,
    receivedFrom: (n) => `Received from ${n}`,
    sentTo: (n) => `Sent to ${n}`,
    betweenWallets: "Between your wallets",
    todayDay: "Today",
    yesterdayDay: "Yesterday",
};

const figures = (tokens: WalletToken[], over: Partial<WalletFigures> = {}): WalletFigures => ({
    tokens,
    settings: { autoConfig: true, minBalance: "1" },
    rates: { ICP: 5 },
    currencyLedgers: { ICP: "icp-ledger" },
    currency: "USD",
    veiled: false,
    locale: "en",
    ...over,
});

const state = { balancesLoading: false, change: undefined, supportedCount: 9 };

describe("the wallet's root", () => {
    test("nothing owned: the empty wallet, with the first five supported tokens and the count", () => {
        const tokens = ["ICP", "CHAT", "BTC", "ETH", "SNS1", "KINIC"].map((s) => tok(s, 0, 2));
        const root = walletRoot(figures(tokens), state, words);
        expect(root.kind).toBe("empty");
        if (root.kind !== "empty") return;
        expect(root.total).toBe("$0.00");
        expect(root.supported.map((t) => t.symbol)).toEqual(["ICP", "CHAT", "BTC", "ETH", "SNS1"]);
        expect(root.supported[0].price).toBe("$2.00");
        expect(root.supportedCount).toBe(9);
    });

    test("not the empty wallet while the balances are still coming", () => {
        const root = walletRoot(
            figures([tok("ICP", 0, 5)]),
            { ...state, balancesLoading: true },
            words,
        );
        expect(root.kind).toBe("funded");
    });

    test("tokens largest first, with amount, value and share; small balances folded", () => {
        const tokens = [tok("CHAT", 100, 0.2), tok("ICP", 10, 5), tok("GHOST", 5, 0.1)];
        const root = walletRoot(figures(tokens), state, words);
        if (root.kind !== "funded") throw new Error("funded");
        expect(root.tokens.map((t) => t.symbol)).toEqual(["ICP", "CHAT"]);
        expect(root.tokens[0]).toMatchObject({ amount: "10", value: "$50.00" });
        expect(root.tokens[0].share).toBeCloseTo((50 / 70.5) * 100);
        expect(root.total).toBe("$70.50");
        expect(root.count).toBe("2 tokens");
        expect(root.small).toMatchObject({
            title: "1 small balances",
            sub: "Under $1.00 each",
            total: "$0.50",
        });
        expect(root.small?.rows[0]).toMatchObject({ symbol: "GHOST", amount: "5.00" });
    });

    test("no price pill on the token that is the display currency", () => {
        const tokens = [tok("ICP", 10, 5), tok("CHAT", 100, 0.2)];
        const root = walletRoot(figures(tokens, { currency: "ICP" }), state, words);
        if (root.kind !== "funded") throw new Error("funded");
        expect(root.tokens.find((t) => t.symbol === "ICP")?.price).toBeUndefined();
        expect(root.tokens.find((t) => t.symbol === "CHAT")?.price).toBe("0.0400 ICP");
        expect(root.total).toBe("14.00 ICP");
    });

    test("hidden balances: every figure masked, and no today pill", () => {
        const root = walletRoot(
            figures([tok("ICP", 10, 5)], { veiled: true }),
            { ...state, change: 0.1 },
            words,
        );
        if (root.kind !== "funded") throw new Error("funded");
        expect(root.total).toBe("••••");
        expect(root.tokens[0]).toMatchObject({ amount: "••••", value: "••••" });
        expect(root.today).toBeUndefined();
    });

    test("no small balances row without any", () => {
        const root = walletRoot(figures([tok("ICP", 10, 5)]), state, words);
        if (root.kind !== "funded") throw new Error("funded");
        expect(root.small).toBeUndefined();
    });
});

describe("the today pill", () => {
    test("signed, to one place, green up and red down", () => {
        expect(todayPill(0.018, "en", words)).toEqual({ label: "+1.8% today", tone: "success" });
        expect(todayPill(-0.05, "en", words)).toEqual({ label: "-5.0% today", tone: "danger" });
        expect(todayPill(0, "en", words)?.tone).toBe("neutral");
    });

    test("none without a change", () => {
        expect(todayPill(undefined, "en", words)).toBeUndefined();
    });
});

describe("a token's page", () => {
    test("held: its amount and value, share, Send / Receive / Swap with Send leading", () => {
        const tokens = [tok("ICP", 10, 5), tok("CHAT", 250, 0.2)];
        const page = tokenPage(figures(tokens), "icp-ledger");
        expect(page).toMatchObject({
            symbol: "ICP",
            price: "$5.00",
            amount: "10.0000",
            value: "$50.00",
            share: { label: "50.0%" },
            menu: ["send", "receive", "swap"],
        });
        expect(page?.actions).toEqual([
            { flow: "send", primary: true, disabled: false },
            { flow: "receive", primary: false, disabled: false },
            { flow: "swap", primary: false, disabled: false },
        ]);
    });

    test("at zero: Receive first and primary, Send and Swap disabled, no share, Receive alone in the menu", () => {
        const page = tokenPage(figures([tok("ICP", 0, 5)]), "icp-ledger");
        expect(page?.share).toBeUndefined();
        expect(page?.actions).toEqual([
            { flow: "receive", primary: true, disabled: false },
            { flow: "send", primary: false, disabled: true },
            { flow: "swap", primary: false, disabled: true },
        ]);
        expect(page?.menu).toEqual(["receive"]);
    });

    test("a flow the token doesn't offer: disabled, and not in the menu", () => {
        const t = tok("ICP", 10, 5, { actions: ["send", "receive"] });
        const page = tokenPage(figures([t]), "icp-ledger");
        expect(page?.actions.find((a) => a.flow === "swap")?.disabled).toBe(true);
        expect(page?.menu).toEqual(["send", "receive"]);
    });

    test("its share is of everything owned, as the web's: in a manual wallet too, listed or not", () => {
        const tokens = [tok("ICP", 2, 5), tok("CHAT", 200, 0.2)];
        const manual = figures(tokens, { settings: { autoConfig: false, tokens: ["icp-ledger"] } });
        expect(tokenPage(manual, "chat-ledger")?.share).toEqual({ label: "80.0%", percent: 80 });
        expect(tokenPage(manual, "icp-ledger")?.share).toEqual({ label: "20.0%", percent: 20 });
        const nothingListed = figures(tokens, { settings: { autoConfig: false, tokens: [] } });
        expect(tokenPage(nothingListed, "chat-ledger")?.share?.label).toBe("80.0%");
    });

    test("the menu offers exactly the flows whose buttons are enabled, held or not, swappable or not", () => {
        const cases: WalletToken[] = [
            tok("ICP", 10, 5),
            tok("ICP", 10, 5, { actions: ["send", "receive", "refresh"] }),
            tok("ICP", 0, 5),
            tok("ICP", 0, 5, { actions: ["send", "receive", "refresh"] }),
        ];
        for (const t of cases) {
            const page = tokenPage(figures([t]), "icp-ledger");
            const enabled = page?.actions.filter((a) => !a.disabled).map((a) => a.flow);
            expect([...(page?.menu ?? [])].sort()).toEqual([...(enabled ?? [])].sort());
        }
    });

    test("no page for a token the catalogue doesn't have", () => {
        expect(tokenPage(figures([]), "nope")).toBeUndefined();
    });

    test("no price pill when it is the display currency", () => {
        expect(
            tokenPage(figures([tok("ICP", 1, 5)], { currency: "ICP" }), "icp-ledger")?.price,
        ).toBeUndefined();
    });
});

describe("a token's activity", () => {
    const DAY = 86_400_000;
    const now = new Date(2026, 10, 23, 15, 0).getTime();
    const act = (
        id: string,
        kind: WalletActivity["kind"],
        at: number,
        token = "icp-ledger",
    ): WalletActivity => ({
        id,
        symbol: "ICP",
        token,
        kind,
        party: "@lucy",
        timestamp: at,
        amount: 2,
        fiat: 10,
    });
    const activity = [
        act("1", "receive", now - 60_000),
        act("2", "send", now - DAY),
        act("3", "own", now - DAY - 1000),
        act("4", "receive", now, "chat-ledger"),
    ];
    const f = figures([tok("ICP", 10, 5)]);

    test("its own rows, newest first, by day, worded and signed", () => {
        const groups = tokenActivityGroups(
            activity,
            { id: "icp-ledger", symbol: "ICP", dp: 4 },
            0,
            f,
            words,
            now,
        );
        expect(groups.map((g) => g.label)).toEqual(["TODAY", "YESTERDAY"]);
        expect(groups[0].rows[0]).toMatchObject({
            title: "Received from @lucy",
            amount: "+2.0000 ICP",
            fiat: "$10.00",
            positive: true,
            divider: false,
        });
        expect(groups[1].rows.map((r) => [r.title, r.amount, r.divider])).toEqual([
            ["Sent to @lucy", "−2.0000 ICP", false],
            ["Between your wallets", "2.0000 ICP", true],
        ]);
    });

    test("under a filter tab", () => {
        const received = tokenActivityGroups(
            activity,
            { id: "icp-ledger", symbol: "ICP", dp: 4 },
            2,
            f,
            words,
            now,
        );
        expect(received.flatMap((g) => g.rows.map((r) => r.id))).toEqual(["1"]);
        const swaps = tokenActivityGroups(
            activity,
            { id: "icp-ledger", symbol: "ICP", dp: 4 },
            3,
            f,
            words,
            now,
        );
        expect(swaps).toEqual([]);
    });
});

describe("the display currency and the totals", () => {
    test("a tap on the total moves to the next currency priced, round to USD", () => {
        const f = figures([tok("ICP", 1, 5)], { rates: { ICP: 5, BTC: 80_000 } });
        expect(nextDisplayCurrency(f)).toBe("BTC");
        expect(nextDisplayCurrency({ ...f, currency: "BTC" })).toBe("ICP");
        expect(nextDisplayCurrency({ ...f, currency: "ICP" })).toBe("USD");
    });

    test("the total in each currency priced, for the snapshots", () => {
        expect(walletTotals(figures([tok("ICP", 10, 5)]))).toEqual({ USD: 50, ICP: 10 });
    });
});

describe("the Supported tokens sheet", () => {
    const tokens = [tok("ICP", 10, 5), tok("CHAT", 0, 0.2), tok("BTC", 0, 80_000)];

    test("your tokens with amount and value, then the rest with their price", () => {
        const sheet = supportedSheet(figures(tokens), "");
        expect(sheet.yours).toMatchObject([{ symbol: "ICP", right: "10", rightSub: "$50.00" }]);
        expect(sheet.others.map((t) => [t.symbol, t.right, t.rightSub])).toEqual([
            ["CHAT", "$0.2000", undefined],
            ["BTC", "$80,000.00", undefined],
        ]);
    });

    test("searched by symbol or name", () => {
        const sheet = supportedSheet(figures(tokens), " chat ");
        expect(sheet.yours).toEqual([]);
        expect(sheet.others.map((t) => t.symbol)).toEqual(["CHAT"]);
    });
});

describe("where the buttons go", () => {
    test("a flow over the wallet, or over a token's page with it filled", () => {
        expect(flowUrl("receive")).toBe("/wallet/receive");
        expect(flowUrl("send", "ryjl3-tyaaa")).toBe("/wallet/send?token=ryjl3-tyaaa");
        expect(tokenUrl("ryjl3-tyaaa")).toBe("/wallet/ryjl3-tyaaa");
    });
});
