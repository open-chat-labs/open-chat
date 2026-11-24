// A send from the wallet, end to end, for both wallets' Send (the web's WalletSend, the native Send
// screen): the plan (walletSend's sendPlan), then a transfer in the DM with a person or a
// withdrawal to an address, each through the client's PIN prompt, and what came of it. Moved here
// from the web's wallet screen (native N10b).
import type { OpenChat, ResourceKey } from "@client";
import { sendInDirectChat, type TransferToken } from "../cryptoTransfer/cryptoTransferForm.svelte";
import {
    acceptsAddress,
    ownAccounts,
    sendAnswer,
    sendNetworks,
    sendPlan,
    type BtcWithdrawal,
    type SendRequest,
    type SendToken,
} from "./walletSend";

/** What Send asks for, with the person's note when it goes to a person (their DM's caption). */
export type WalletSendRequest = SendRequest & { memo?: string };

/**
 * How a send went: `sent`; `not_sent`, with nothing to say (the PIN prompt was dismissed);
 * `too_small`, under the least a send may be (nothing was sent); `nothing`, nothing to send (no
 * amount, or a Bitcoin send before the minter answered); or `failed`, with why ("pin": the PIN
 * was refused, and the PIN store says how).
 */
export type WalletSendOutcome =
    | { kind: "sent" }
    | { kind: "not_sent" }
    | { kind: "too_small"; minimum: bigint }
    | { kind: "nothing" }
    | { kind: "failed"; reason: ResourceKey | "pin" };

/**
 * Sends what the request asks for, of `token` (its `balance` for Max), once: to a person a transfer
 * in their DM, to an address a withdrawal over the ledger or Bitcoin's own network (`btc`: the
 * ckBTC minter's say, for a Bitcoin send).
 */
export async function sendFromWallet(
    client: Pick<OpenChat, "sendCryptoTransfer" | "withdraw">,
    token: SendToken & TransferToken,
    balance: bigint,
    request: WalletSendRequest,
    btc: BtcWithdrawal | undefined,
): Promise<WalletSendOutcome> {
    const plan = sendPlan(request, token, balance, btc);
    if (plan === undefined) return { kind: "nothing" };
    if (plan.kind === "too_small") return plan;
    const outcome =
        plan.kind === "transfer"
            ? await sendInDirectChat(client, token, plan.userId, plan.amount, request.memo ?? "")
            : await client.withdraw({
                  ledger: token.ledger,
                  symbol: token.symbol,
                  route: plan.route,
                  to: plan.to,
                  amount: plan.amount,
                  fee: plan.fee,
              });
    return sendAnswer(outcome);
}

/** The user, as their own wallet's addresses are worked out. */
export type WalletOwner = { cryptoAccount: string; userId: string; principal: () => string };

/**
 * Whether Send may send a token (by symbol) to an address: never the user's own wallet, nor an
 * account of a MultiUser user id, and only on a network the send can reach. The user's own wallet
 * is worked out once per symbol.
 */
export function walletAddressCheck(
    owner: WalletOwner,
    isUserIdAccount: (address: string) => boolean,
): (address: string, symbol: string) => boolean {
    const bySymbol = new Map<string, string[]>();
    const own = (symbol: string): string[] => {
        let accounts = bySymbol.get(symbol);
        if (accounts === undefined) {
            accounts = ownAccounts(symbol, owner);
            bySymbol.set(symbol, accounts);
        }
        return accounts;
    };
    return (address, symbol) =>
        acceptsAddress(address, sendNetworks(symbol), {
            ownAccounts: own(symbol),
            isUserIdAccount,
        });
}
