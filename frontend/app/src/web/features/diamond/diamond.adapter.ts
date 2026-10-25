import {
    walletApprovalFee,
    type DiamondMembershipDuration,
    type DiamondMembershipFees,
    type DiamondMembershipStatus,
    type EnhancedTokenDetails,
} from "@client";
import type { PlanKey } from "@openchat/ui/src/features/components/DiamondContent.svelte";
import { diamondPriceE8s, insufficientFunds } from "@src/logic/diamond/diamondPayment.svelte";
import type { WalletToken } from "@openchat/ui/src/lib/types";

// DiamondDialog's props from the backend's fees, the user's membership and their CHAT and ICP.

const PLAN_DURATIONS: Record<PlanKey, DiamondMembershipDuration> = {
    "1m": "one_month",
    "3m": "three_months",
    "1y": "one_year",
    life: "lifetime",
};

/** The membership length a plan buys. */
export function planDuration(plan: PlanKey): DiamondMembershipDuration {
    return PLAN_DURATIONS[plan];
}

function units(e8s: bigint, decimals: number): number {
    return Number(e8s) / 10 ** decimals;
}

/**
 * Each plan's price per token, the backend's own (whole tokens, 8 decimals for CHAT and ICP): the
 * dialog offers only these tokens, at these prices, and the price sent is looked up again from the
 * fees, never taken from the dialog (logic/diamond).
 */
export function diamondTokenPrices(
    fees: DiamondMembershipFees[],
): Record<string, Partial<Record<PlanKey, number>>> {
    return Object.fromEntries(
        fees.map((f) => [
            f.token,
            {
                "1m": units(f.oneMonth, 8),
                "3m": units(f.threeMonths, 8),
                "1y": units(f.oneYear, 8),
                life: units(f.lifetime, 8),
            },
        ]),
    );
}

/** The dialog's membership props: not a member, a lifetime member, or a member until a date. */
export function diamondMembershipProps(
    status: DiamondMembershipStatus,
):
    | { isDiamond: false }
    | { isDiamond: true; lifetime: true }
    | { isDiamond: true; memberUntil: string } {
    if (status.kind === "lifetime") return { isDiamond: true, lifetime: true };
    if (status.kind === "active") {
        return { isDiamond: true, memberUntil: new Date(Number(status.expiresAt)).toISOString() };
    }
    return { isDiamond: false };
}

/** A member whose membership ends opens straight on the plans, to extend it. */
export function openingPlan(status: DiamondMembershipStatus): PlanKey | null {
    return status.kind === "active" ? "1m" : null;
}

/**
 * The tokens Diamond can be paid in, as the dialog lists them: their balance and fee in whole tokens,
 * and their logo as the mark's background.
 */
export function diamondWalletTokens(tokens: EnhancedTokenDetails[]): WalletToken[] {
    return tokens.map((t) => {
        const held = units(t.balance, t.decimals);
        return {
            symbol: t.symbol,
            name: t.name,
            mark: "",
            grad: `url("${t.logo}") center / cover`,
            held,
            price: held > 0 && t.dollarBalance !== undefined ? t.dollarBalance / held : 0,
            dp: Math.min(t.decimals, 8),
            fee: units(t.transferFee, t.decimals),
            payable: true,
        };
    });
}

/** The approval a payment from the user's wallet makes before the price is pulled, per token (whole tokens). */
export function diamondApprovalFees(tokens: EnhancedTokenDetails[]): Record<string, number> {
    return Object.fromEntries(
        tokens.map((t) => [t.symbol, units(walletApprovalFee(t.transferFee), t.decimals)]),
    );
}

/**
 * Whether each token can pay each plan from the user's OpenChat wallet, worked out in e8s with the
 * approval fee (logic/diamond), so the dialog doesn't compare floating point sums: a balance of
 * exactly the price and fee can pay.
 */
export function diamondAffordable(
    fees: DiamondMembershipFees[],
    tokens: EnhancedTokenDetails[],
): Record<string, Partial<Record<PlanKey, boolean>>> {
    const plans = Object.keys(PLAN_DURATIONS) as PlanKey[];
    return Object.fromEntries(
        tokens.map((t) => [
            t.symbol,
            Object.fromEntries(
                plans.flatMap((plan) => {
                    const price = diamondPriceE8s(fees, t.symbol, PLAN_DURATIONS[plan]);
                    return price === undefined
                        ? []
                        : [[plan, !insufficientFunds(price, t.transferFee, t.balance, false)]];
                }),
            ),
        ]),
    );
}
