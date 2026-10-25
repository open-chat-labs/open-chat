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
import { pinNumberErrorMessage } from "@src/stores/pinNumber";

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

/**
 * What paying from the user's OpenChat wallet takes from it: the price (which includes the
 * transfer's fee) and the approval the user makes before the price is pulled.
 */
export function walletCostE8s(priceE8s: bigint, transferFee: bigint): bigint {
    return priceE8s + walletApprovalFee(transferFee);
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

export type DiamondPaymentOutcome =
    | { kind: "success"; proof: string }
    | { kind: "cancelled" }
    | { kind: "failed"; message: ResourceKey };

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
    fees = $state.raw<DiamondMembershipFees[] | undefined>(undefined);
    paying = $state(false);

    constructor(private client: Client) {}

    async loadFees(): Promise<void> {
        this.fees = await this.client.diamondMembershipFees();
    }

    /** The backend's price for `duration` in `token`, once the fees are loaded. */
    price(token: string, duration: DiamondMembershipDuration): bigint | undefined {
        return this.fees === undefined ? undefined : diamondPriceE8s(this.fees, token, duration);
    }

    async pay(request: DiamondPaymentRequest): Promise<DiamondPaymentOutcome> {
        const price = this.price(request.token, request.duration);
        if (this.paying || price === undefined) return { kind: "failed", message: PAYMENT_FAILED };
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
            const pin = resp.kind === "error" ? pinNumberFailureFromError(resp) : undefined;
            const message = pin === undefined ? undefined : pinNumberErrorMessage(pin, Date.now());
            return { kind: "failed", message: message ?? PAYMENT_FAILED };
        } catch (err) {
            // #10131 invariant 4: the PIN prompt dismissed
            if (err === "cancelled") return { kind: "cancelled" };
            console.warn("Diamond payment failed", err);
            return { kind: "failed", message: PAYMENT_FAILED };
        } finally {
            this.paying = false;
        }
    }
}
