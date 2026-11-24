// Send, Receive and Swap (native design notes §3.9 Flows; the plan's 13) as the native screens draw
// them: what each pinned button says and whether it can go, the amount's quick picks, the address
// as Receive splits it. The rules are the web wallet's (logic/wallet: walletSend's routes, costs
// and minimums; the swap's fees), worked out in ledger units, exactly (6b invariant 1).
import { BTC_SYMBOL } from "@client";
import {
    amountUnits,
    minimumSend,
    sendCost,
    type BtcWithdrawal,
} from "@src/logic/wallet/walletSend";
import { addressNetwork } from "@src/utils/cryptoAddress";
import { searchContacts, type Recipient, type SendContact } from "@src/logic/wallet/walletFlows";
import type { WalletToken } from "@openchat/ui/src/lib/types";
import { currencyRates, formatMoney, walletTokenId } from "@openchat/ui/src/lib/wallet";
import type { WalletFigures } from "./wallet.adapter";

/** A token of the catalogue by its id (its ledger), as the wallet shows it. */
export function tokenFace(f: WalletFigures, id: string | undefined): WalletToken | undefined {
    return id === undefined ? undefined : f.tokens.find((t) => walletTokenId(t) === id);
}

/** A value in USD in the display currency ("$12.00", "0.0041 BTC"). */
export function displayValue(f: WalletFigures, usd: number): string {
    return formatMoney(usd, f.currency, currencyRates(f.tokens, f.rates), f.locale);
}

/** A token as a flow needs it, in ledger units. */
export type FlowToken = { symbol: string; decimals: number; transferFee: bigint; balance: bigint };

/** An address as Receive shows it: the middle dimmed, between its first and last six characters. */
export function addressParts(address: string): { head: string; middle: string; tail: string } {
    if (address.length <= 12) return { head: address, middle: "", tail: "" };
    return { head: address.slice(0, 6), middle: address.slice(6, -6), tail: address.slice(-6) };
}

/** An address in a row: its first and last six characters. */
export function shortAddress(address: string): string {
    const p = addressParts(address);
    return p.middle === "" ? address : `${p.head}…${p.tail}`;
}

/** Ledger units as a plain decimal in whole tokens, exactly, without trailing zeros ("1.5"). */
export function plainUnits(units: bigint, decimals: number): string {
    const negative = units < 0n;
    const digits = (negative ? -units : units).toString().padStart(decimals + 1, "0");
    const whole = digits.slice(0, digits.length - decimals);
    const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

/**
 * An amount as it's typed: digits and one decimal point (a comma taken as one), at most `decimals`
 * after it.
 */
export function cleanAmount(text: string, decimals: number): string {
    const plain = text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const dot = plain.indexOf(".");
    if (dot < 0) return plain;
    const fraction = plain
        .slice(dot + 1)
        .replace(/\./g, "")
        .slice(0, decimals);
    return `${plain.slice(0, dot)}.${fraction}`;
}

/** The quick picks under an amount: a quarter, a half, three quarters, and all of it. */
export const QUICK_PICKS = [25, 50, 75, 100] as const;
export type QuickPick = (typeof QUICK_PICKS)[number];

/** A quick pick of what's available, rounded down to a unit, as the amount field takes it. */
export function quickAmount(available: bigint, pick: QuickPick, decimals: number): string {
    if (available <= 0n) return "0";
    return plainUnits((available * BigInt(pick)) / 100n, decimals);
}

/** Who a send goes to. */
export type SendTo =
    | { kind: "person"; userId: string; name: string; handle: string }
    | { kind: "address"; address: string; name?: string };

/** How a send travels: a transfer to a person, over the ledger, or over Bitcoin's own network. */
export type SendRoute = "person" | "address" | "btc";

/** A send's route: BTC to a Bitcoin address goes over Bitcoin's own network (the web's `btcRoutes`). */
export function sendRoute(symbol: string, to: SendTo): SendRoute {
    if (to.kind === "person") return "person";
    return symbol === BTC_SYMBOL && addressNetwork(to.address) === "btc" ? "btc" : "address";
}

/** The network Send asks for (walletSend's SendRequest): "btc" for Bitcoin's own, else the ledger's. */
export function sendNetwork(route: SendRoute): string {
    return route === "btc" ? "btc" : "ledger";
}

/**
 * The recipient sheet (the prototype's "Send to"): an address typed or pasted in the search that
 * the token can be sent to, then the saved addresses and the people (those already DM'd, latest
 * first: "Recent") that match it; all of them with no search.
 */
export function recipientSheet(
    query: string,
    contacts: SendContact[],
    saved: Recipient[],
    takesAddress: (address: string) => boolean,
): { address: string | undefined; saved: Recipient[]; people: SendContact[] } {
    const text = query.trim();
    const needle = text.toLowerCase();
    return {
        address: text !== "" && takesAddress(text) ? text : undefined,
        saved:
            needle === ""
                ? saved
                : saved.filter(
                      (r) =>
                          r.name.toLowerCase().includes(needle) ||
                          r.address.toLowerCase().includes(needle),
                  ),
        people: needle === "" ? contacts : searchContacts(contacts, text),
    };
}

/** What Send's button says, and so whether it can go (only `send`). */
export type SendCta =
    | { kind: "choose_token" }
    | { kind: "choose_recipient" }
    | { kind: "enter_amount" }
    | { kind: "over_balance" }
    | { kind: "too_small"; minimum: bigint }
    | { kind: "waiting_fee" }
    | { kind: "send"; amount: bigint };

/**
 * Send's form as it stands: the button, and the fee and total its rows show (once there's a token
 * and a recipient; the fee is the route's, from the ledger, never the form's: 6b invariant 2). Max
 * sends what's left after the fee. Under the least a send may be (ten fees to a person, the ckBTC
 * minter's minimum to a Bitcoin address) can't go, as sendPlan refuses it.
 */
export function sendCheck(input: {
    token: FlowToken | undefined;
    to: SendTo | undefined;
    amountText: string;
    max: boolean;
    btc: BtcWithdrawal | undefined;
}): { cta: SendCta; fee: bigint | undefined; total: bigint | undefined } {
    const { token, to } = input;
    if (token === undefined)
        return { cta: { kind: "choose_token" }, fee: undefined, total: undefined };
    if (to === undefined)
        return { cta: { kind: "choose_recipient" }, fee: undefined, total: undefined };
    const route = sendRoute(token.symbol, to);
    if (route === "btc" && input.btc === undefined) {
        return { cta: { kind: "waiting_fee" }, fee: undefined, total: undefined };
    }
    const fee = sendCost(token, route, input.btc);
    const amount = input.max ? token.balance - fee : amountUnits(input.amountText, token.decimals);
    if (amount <= 0n) {
        return {
            cta: input.max ? { kind: "over_balance" } : { kind: "enter_amount" },
            fee,
            total: undefined,
        };
    }
    const total = amount + fee;
    if (total > token.balance) return { cta: { kind: "over_balance" }, fee, total };
    if (route === "person" && amount < minimumSend(token)) {
        return { cta: { kind: "too_small", minimum: minimumSend(token) }, fee, total };
    }
    if (route === "btc" && input.btc !== undefined && amount + input.btc.fee < input.btc.minimum) {
        return {
            cta: { kind: "too_small", minimum: input.btc.minimum - input.btc.fee },
            fee,
            total,
        };
    }
    return { cta: { kind: "send", amount }, fee, total };
}

/** What a send can spend: the balance less the route's fee (the quick picks' whole). */
export function sendAvailable(token: FlowToken, route: SendRoute, btc?: BtcWithdrawal): bigint {
    const left = token.balance - sendCost(token, route, btc);
    return left > 0n ? left : 0n;
}

/** What Swap's button says, and so whether it can go (`get_quote` or `swap`). */
export type SwapCta =
    | { kind: "choose_tokens" }
    | { kind: "restricted" }
    | { kind: "enter_amount" }
    | { kind: "over_balance" }
    | { kind: "too_small"; minimum: bigint }
    | { kind: "getting_quote" }
    | { kind: "get_quote" }
    | { kind: "confirm_warning" }
    | { kind: "swap" };

/**
 * Swap's form as it stands. The amount is everything that leaves the wallet (the approve and pull
 * fees come out of it), so Max is the whole balance and three fees or less is too little to swap,
 * as the web's Swap has it. No quote is asked for where swapping is restricted (6c invariant 1); a
 * quote with a value warning waits for the user to confirm it (6c's value warning).
 */
export function swapCheck(input: {
    from: FlowToken | undefined;
    toChosen: boolean;
    amountText: string;
    restricted: boolean | undefined;
    quoting: boolean;
    quoted: boolean;
    warning: boolean;
    warningConfirmed: boolean;
}): SwapCta {
    if (input.restricted === true) return { kind: "restricted" };
    const from = input.from;
    if (from === undefined || !input.toChosen) return { kind: "choose_tokens" };
    const amount = amountUnits(input.amountText, from.decimals);
    if (amount <= 0n) return { kind: "enter_amount" };
    if (amount > from.balance) return { kind: "over_balance" };
    if (amount <= 3n * from.transferFee)
        return { kind: "too_small", minimum: 3n * from.transferFee };
    if (input.quoting) return { kind: "getting_quote" };
    if (!input.quoted) return { kind: "get_quote" };
    if (input.warning && !input.warningConfirmed) return { kind: "confirm_warning" };
    return { kind: "swap" };
}

/** How many of `out` one whole `in` buys at the quote (for its Rate row). */
export function swapRate(
    amountIn: bigint,
    decimalsIn: number,
    amountOut: bigint,
    decimalsOut: number,
): number {
    if (amountIn <= 0n) return 0;
    return Number(amountOut) / 10 ** decimalsOut / (Number(amountIn) / 10 ** decimalsIn);
}

/** The max slippages Swap offers, in percent; 1% to start with (the prototype's). */
export const SLIPPAGES = [0.5, 1, 2, 3] as const;
export const DEFAULT_SLIPPAGE_INDEX = 1;
