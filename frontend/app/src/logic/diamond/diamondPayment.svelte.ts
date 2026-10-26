// Paying for Diamond membership, in every tree: the backend's price for a token and duration, what
// the payment takes from the user's wallet, the auto-renew rule, when an extension ends, and the
// payment, whose outcome the view shows. The external wallet's approval opens from the view's
// click handler (a popup must open from the click), and hands its account to `pay`.

import {
    diamondDurationToMs,
    pinNumberFailureFromError,
    walletApprovalFee,
    type DiamondMembershipDuration,
    type DiamondMembershipFees,
    type OpenChat,
    type ResourceKey,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";

/** The membership lengths, shortest first. */
export const DIAMOND_DURATIONS: DiamondMembershipDuration[] = [
    "one_month",
    "three_months",
    "one_year",
    "lifetime",
];

/** The tokens Diamond can be paid in: the backend has a fixed price in each. */
export type DiamondToken = DiamondMembershipFees["token"];

const FEE_KEYS: Record<DiamondMembershipDuration, keyof Omit<DiamondMembershipFees, "token">> = {
    one_month: "oneMonth",
    three_months: "threeMonths",
    one_year: "oneYear",
    lifetime: "lifetime",
};

/**
 * The backend's price, in e8s, for `duration` paid in `token` (#10131 invariant 1: what's sent as
 * the expected price, never an amount converted from another token), or undefined when it has none.
 */
export function diamondPriceE8s(
    fees: DiamondMembershipFees[],
    token: string,
    duration: DiamondMembershipDuration,
): bigint | undefined {
    return fees.find((f) => f.token === token)?.[FEE_KEYS[duration]];
}

/** The approval a payment from the user's OpenChat wallet makes before the price is pulled, in e8s. */
export function approvalFeeE8s(transferFee: bigint): bigint {
    return walletApprovalFee(transferFee);
}

/**
 * What paying from the user's OpenChat wallet takes from it: the price (which includes the
 * transfer's fee) and the approval the user makes before the price is pulled.
 */
export function walletCostE8s(priceE8s: bigint, transferFee: bigint): bigint {
    return priceE8s + approvalFeeE8s(transferFee);
}

/**
 * Whether the OpenChat wallet can't pay (#10131 invariant 3): the price and the approval fee above
 * its balance by even 1 e8 (compared in e8s, where any tolerance could hide an ICP fee). Not checked
 * when an external wallet pays.
 */
export function insufficientFunds(
    priceE8s: bigint,
    transferFee: bigint,
    balanceE8s: bigint,
    fromExternalWallet: boolean,
): boolean {
    return !fromExternalWallet && walletCostE8s(priceE8s, transferFee) > balanceE8s;
}

/** Whether the membership renews itself (#10131 invariant 2): never for lifetime. */
export function recurring(autoRenew: boolean, duration: DiamondMembershipDuration): boolean {
    return autoRenew && duration !== "lifetime";
}

/**
 * When a membership bought now for `duration` ends, in ms: from the current one's end
 * (`expiresAt`) while it runs, else from `now`; undefined for lifetime, which never ends.
 */
export function membershipEnd(
    duration: DiamondMembershipDuration,
    now: number,
    expiresAt?: number,
): number | undefined {
    if (duration === "lifetime") return undefined;
    const from = expiresAt !== undefined && expiresAt > now ? expiresAt : now;
    return from + diamondDurationToMs(duration);
}

/**
 * How a payment went: paid (with its proof); cancelled (the PIN prompt dismissed); a PIN failure
 * (the view shows the PIN's own message, which counts down a lockout: `pinNumberErrorMessageStore`);
 * failed (with what to say, and the cause when it threw); or ignored, a payment being under way.
 */
export type DiamondPaymentOutcome =
    | { kind: "success"; proof: string }
    | { kind: "cancelled" }
    | { kind: "pin_failed" }
    | { kind: "failed"; message: ResourceKey; cause?: unknown }
    | { kind: "already_paying" };

/** The fees as the view has them: loading, loaded, or failed (to try again). */
export type DiamondFees =
    | { kind: "loading" }
    | { kind: "loaded"; fees: DiamondMembershipFees[] }
    | { kind: "failed" };

/** A payment: the token (its ledger and symbol), the length, auto-renew, and an external wallet's account. */
export type DiamondPaymentRequest = {
    ledger: string;
    token: string;
    duration: DiamondMembershipDuration;
    autoRenew: boolean;
    fromAccount?: string;
};

const PAYMENT_FAILED = i18nKey("upgrade.paymentFailed");

type Client = Pick<OpenChat, "payForDiamondMembership" | "diamondMembershipFees">;

/**
 * The Diamond payment for a view: the backend's fees (loaded once), and paying, one payment at a
 * time. A payment asks for the PIN first when paying from the OpenChat wallet; dismissing that
 * prompt cancels it, which isn't a failure.
 */
export class DiamondPayment {
    feesState = $state.raw<DiamondFees>({ kind: "loading" });
    paying = $state(false);

    constructor(private client: Client) {}

    /** The fees once loaded. */
    get fees(): DiamondMembershipFees[] | undefined {
        return this.feesState.kind === "loaded" ? this.feesState.fees : undefined;
    }

    /** Loads the fees; a failure is the state's (`failed`, to try again), never a rejection. */
    async loadFees(): Promise<void> {
        this.feesState = { kind: "loading" };
        try {
            this.feesState = { kind: "loaded", fees: await this.client.diamondMembershipFees() };
        } catch (err) {
            console.warn("Unable to load the Diamond fees", err);
            this.feesState = { kind: "failed" };
        }
    }

    /** The backend's price for `duration` in `token`, once the fees are loaded. */
    price(token: string, duration: DiamondMembershipDuration): bigint | undefined {
        return this.fees === undefined ? undefined : diamondPriceE8s(this.fees, token, duration);
    }

    async pay(request: DiamondPaymentRequest): Promise<DiamondPaymentOutcome> {
        // a second press (or an approval landing) while one is under way: nothing to report
        if (this.paying) return { kind: "already_paying" };
        const price = this.price(request.token, request.duration);
        if (price === undefined) return { kind: "failed", message: PAYMENT_FAILED };
        this.paying = true;
        try {
            const resp = await this.client.payForDiamondMembership(
                request.ledger,
                request.duration,
                recurring(request.autoRenew, request.duration),
                price,
                request.fromAccount,
            );
            if (resp.kind === "success") return { kind: "success", proof: resp.proof };
            // #10131 invariant 4: a PIN failure says why, not that the payment failed
            if (resp.kind === "error" && pinNumberFailureFromError(resp) !== undefined) {
                return { kind: "pin_failed" };
            }
            return { kind: "failed", message: PAYMENT_FAILED };
        } catch (err) {
            // #10131 invariant 4: the PIN prompt dismissed
            if (err === "cancelled") return { kind: "cancelled" };
            // something someone can act on (the user may have been charged): the cause goes with it
            return { kind: "failed", message: PAYMENT_FAILED, cause: err };
        } finally {
            this.paying = false;
        }
    }
}
