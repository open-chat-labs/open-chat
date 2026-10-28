// A send from the wallet, as the web wallet's Send asks for it: the amount in the ledger's units,
// exactly; the fee from the token's ledger; and where it goes, to a person in their DM or to an
// address over the route the address calls for.
import {
    BTC_SYMBOL,
    ICP_SYMBOL,
    walletApprovalFee,
    type CryptoTransferOutcome,
    type ResourceKey,
    type WithdrawalRoute,
    type WithdrawOutcome,
} from "@client";
import { addressNetwork, type AddressNetwork } from "@src/utils/cryptoAddress";

/**
 * A decimal amount in whole tokens ("1.5", "0.00000001") as the ledger's units, exactly: digits
 * are moved, never multiplied as a float (6b invariant 1). Digits past the token's decimals are
 * dropped (rounded down); anything that isn't a plain decimal is 0.
 */
export function amountUnits(text: string, decimals: number): bigint {
    const match = text.trim().match(/^(\d*)(?:[.,](\d*))?$/);
    if (match === null || (match[1] === "" && (match[2] ?? "") === "")) return 0n;
    const whole = match[1] || "0";
    const fraction = (match[2] ?? "").slice(0, decimals).padEnd(decimals, "0");
    return BigInt(whole + fraction);
}

/** The token sent, as the ledger has it. */
export type SendToken = { ledger: string; symbol: string; decimals: number; transferFee: bigint };

/** What the Send form asked for. */
export type SendRequest = {
    amountText: string;
    /** The whole available balance (Max). */
    max: boolean;
    /** An OpenChat user, or an address. */
    userId?: string;
    to: string;
    /** The network the form chose: "btc" for a native Bitcoin send, else the token's own ledger. */
    network: string;
};

/**
 * The send to make: a transfer in the DM with a person (`sendInDirectChat`, which pays the ledger's
 * fee), or a withdrawal to an address paying `fee`. `too_small`: under the ckBTC minter's minimum
 * for a Bitcoin withdrawal, so nothing is sent.
 */
export type SendPlan =
    | { kind: "transfer"; userId: string; amount: bigint }
    | { kind: "withdraw"; to: string; route: WithdrawalRoute; amount: bigint; fee: bigint }
    | { kind: "too_small"; minimum: bigint };

/** The ckBTC minter's say on a Bitcoin withdrawal: its fee (an estimate) and the least it takes. */
export type BtcWithdrawal = { fee: bigint; minimum: bigint };

/**
 * What a send's route costs on top of what arrives, in ledger units, as Send shows it (6b
 * invariant 2: from the ledger, never the form): one fee to an address; to a person, the approval
 * their transfer is pulled through as well; to a Bitcoin address, the approval, the fee and the
 * minter's own fee, sent on top so that what arrives is what the user typed.
 */
export function sendCost(
    token: Pick<SendToken, "transferFee">,
    to: "person" | "address" | "btc",
    btc?: BtcWithdrawal,
): bigint {
    const fee = token.transferFee;
    if (to === "address") return fee;
    if (to === "person") return fee + walletApprovalFee(fee);
    return fee + walletApprovalFee(fee) + (btc?.fee ?? 0n);
}

/**
 * The send the form's request makes (6b invariants 2 and 3): to a person, a transfer in the DM
 * with that user id; to an address, a withdrawal over the ledger, or Bitcoin's own network when
 * the form chose it (burning the minter's fee on top of the amount). The fee is always the token's
 * ledger fee, never the form's figure. Max sends what's left after `sendCost`. No plan for nothing
 * to send, or for a Bitcoin send before the minter has answered.
 */
export function sendPlan(
    request: SendRequest,
    token: SendToken,
    balance: bigint,
    btc?: BtcWithdrawal,
): SendPlan | undefined {
    const fee = token.transferFee;
    const userId = request.userId;
    const native = userId === undefined && request.network === "btc";
    if (native && btc === undefined) return undefined;
    const to = userId !== undefined ? "person" : native ? "btc" : "address";
    const amount = request.max
        ? balance - sendCost(token, to, btc)
        : amountUnits(request.amountText, token.decimals);
    if (amount <= 0n) return undefined;
    if (userId !== undefined) return { kind: "transfer", userId, amount };
    if (!native || btc === undefined) {
        return { kind: "withdraw", to: request.to, route: { kind: "ledger" }, amount, fee };
    }
    const burnt = amount + btc.fee;
    if (burnt < btc.minimum) return { kind: "too_small", minimum: btc.minimum };
    return { kind: "withdraw", to: request.to, route: { kind: "btc" }, amount: burnt, fee };
}

/** Who can't be sent to, and what's the user's own. */
export type AddressContext = {
    /** The user's own wallet for the token, which they can't send to. */
    ownAccount: string;
    /** An account of a MultiUser user id: anything sent there is lost. */
    isUserIdAccount: (address: string) => boolean;
};

/**
 * Whether a send could reach an address on the networks it may be on: never the user's own wallet,
 * never an account of a MultiUser user id (whatever the network), and only an address on one of
 * `networks`. WithdrawForm and the web wallet's Send both ask this.
 */
export function acceptsAddress(
    address: string,
    networks: AddressNetwork[],
    ctx: AddressContext,
): boolean {
    if (address === ctx.ownAccount) return false;
    if (ctx.isUserIdAccount(address)) return false;
    const network = addressNetwork(address);
    return network !== undefined && networks.includes(network);
}

/**
 * The networks a token's address may be on, sending over its ledger or (for BTC) Bitcoin's own
 * network: an ICP account identifier only for ICP, a Bitcoin address only for BTC.
 */
export function sendNetworks(symbol: string): AddressNetwork[] {
    if (symbol === ICP_SYMBOL) return ["icrc", "icp"];
    if (symbol === BTC_SYMBOL) return ["icrc", "btc"];
    return ["icrc"];
}

/**
 * What Send hears of a send (6b invariant 5): sent, so the receipt reads "Sent"; nothing sent, with
 * nothing to say (the user dismissed the PIN prompt), so the form stays as it was; or failed, with
 * why ("pin": the PIN was refused, and the PIN store says how), so nothing reads "Sent" either.
 */
export type SendAnswer =
    | { kind: "sent" }
    | { kind: "not_sent" }
    | { kind: "failed"; reason: ResourceKey | "pin" };

export function sendAnswer(outcome: CryptoTransferOutcome | WithdrawOutcome): SendAnswer {
    switch (outcome.kind) {
        case "sent":
            return { kind: "sent" };
        case "cancelled":
            return { kind: "not_sent" };
        case "pin_failed":
            return { kind: "failed", reason: "pin" };
        case "failed":
            return { kind: "failed", reason: outcome.message };
    }
}
