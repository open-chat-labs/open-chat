import type { DiamondMembershipFees, EnhancedTokenDetails } from "@client";
import {
    diamondApprovalFees,
    diamondMembershipProps,
    diamondTokenPrices,
    diamondWalletTokens,
    openingPlan,
    planDuration,
} from "./diamond.adapter";

const E8S = 100_000_000n;

const token = (symbol: string, balance: bigint, dollarBalance?: number): EnhancedTokenDetails => ({
    name: symbol === "CHAT" ? "OpenChat" : "Internet Computer",
    symbol,
    ledger: `${symbol}-ledger`,
    index: undefined,
    decimals: 8,
    transferFee: 100_000n,
    logo: `/${symbol}.svg`,
    infoUrl: "",
    transactionUrlFormat: "",
    supportedStandards: [],
    added: 0n,
    enabled: true,
    oneSecEnabled: false,
    evmContractAddresses: [],
    lastUpdated: 0n,
    balance,
    dollarBalance,
    icpBalance: undefined,
    btcBalance: undefined,
    ethBalance: undefined,
    zero: balance === 0n,
    urlFormat: "",
});

describe("the Diamond dialog's props", () => {
    test("prices each plan in each token the backend prices, as whole tokens", () => {
        const fees: DiamondMembershipFees[] = [
            {
                token: "CHAT",
                oneMonth: 15n * E8S,
                threeMonths: 35n * E8S,
                oneYear: 100n * E8S,
                lifetime: 400n * E8S,
            },
            {
                token: "ICP",
                oneMonth: E8S / 2n,
                threeMonths: E8S,
                oneYear: 3n * E8S,
                lifetime: 12n * E8S,
            },
        ];
        expect(diamondTokenPrices(fees)).toEqual({
            CHAT: { "1m": 15, "3m": 35, "1y": 100, life: 400 },
            ICP: { "1m": 0.5, "3m": 1, "1y": 3, life: 12 },
        });
    });

    test("a plan buys its membership length", () => {
        expect(["1m", "3m", "1y", "life"].map((p) => planDuration(p as "1m"))).toEqual([
            "one_month",
            "three_months",
            "one_year",
            "lifetime",
        ]);
    });

    test("say what the user's membership is, and open a timed member on the plans", () => {
        expect(diamondMembershipProps({ kind: "inactive" })).toEqual({ isDiamond: false });
        expect(diamondMembershipProps({ kind: "lifetime" })).toEqual({
            isDiamond: true,
            lifetime: true,
        });
        const until = Date.UTC(2026, 11, 1);
        const active = {
            kind: "active" as const,
            payInChat: true,
            subscription: "one_month" as const,
            expiresAt: BigInt(until),
        };
        expect(diamondMembershipProps(active)).toEqual({
            isDiamond: true,
            memberUntil: new Date(until).toISOString(),
        });
        expect(openingPlan(active)).toBe("1m");
        expect(openingPlan({ kind: "lifetime" })).toBeNull();
        expect(openingPlan({ kind: "inactive" })).toBeNull();
    });

    test("list CHAT and ICP with their balance, fee, price and logo, and the approval fee each costs", () => {
        const [chat] = diamondWalletTokens([token("CHAT", 250n * E8S, 50)]);
        expect(chat).toMatchObject({
            symbol: "CHAT",
            held: 250,
            fee: 0.001,
            price: 0.2,
            payable: true,
        });
        expect(chat.grad).toContain("/CHAT.svg");
        expect(diamondWalletTokens([token("ICP", 0n)])[0].price).toBe(0);
        expect(diamondApprovalFees([token("CHAT", 0n), token("ICP", 0n)])).toEqual({
            CHAT: 0.001,
            ICP: 0.001,
        });
    });
});
