// The wallet's data in the library's shapes: the tokens WalletPanel and WalletMain list, and a
// token's history as WalletMain's activity rows.
import {
    walletApprovalFee,
    type AccountTransaction,
    type EnhancedTokenDetails,
    type NamedAccount,
    type TokenExchangeRates,
    type UserLookup,
    type UserSummary,
    type WalletConfig,
} from "@client";
import type { WalletPanelSettings } from "@openchat/ui/src/features/components/WalletPanel.svelte";
import type { WalletActivity } from "@openchat/ui/src/features/components/WalletMain.svelte";
import type { ReceiveNetwork } from "@openchat/ui/src/features/components/WalletReceive.svelte";
import type { SendContact } from "@openchat/ui/src/features/components/WalletSend.svelte";
import type { DepositNote } from "@src/logic/wallet/receiveAccount.svelte";
import type { Recipient } from "@openchat/ui/src/features/components/WalletRecipients.svelte";
import type { AddressNetwork } from "@src/utils/cryptoAddress";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import type { WalletToken, WalletTokenAction } from "@openchat/ui/src/lib/types";
import {
    counterpartyName,
    transactionCounterparty,
    transactionDirection,
    type MyWallets,
} from "@src/logic/wallet/accountTransactions";
import {
    tokenActions,
    type TokenAction,
    type TokenActionsContext,
} from "@src/logic/wallet/tokenActions";
import { sendNetworks } from "@src/logic/wallet/walletSend";
import { swatchFor } from "../chats/chatList.adapter";

/** The standard the token page names: ICRC-2 when the ledger has it (approvals), else ICRC-1. */
export function tokenStandard(standards: string[]): string | undefined {
    return ["ICRC-2", "ICRC-1"].find((s) => standards.includes(s));
}

/** A whole-token amount from the ledger's units. */
export function wholeTokens(amount: bigint, decimals: number): number {
    return Number(amount) / 10 ** decimals;
}

/**
 * How many decimal places the wallet shows for a token: 8 (at most its own) for one worth a lot a
 * unit (BTC, ETH), 2 for a dollar-ish one (stablecoins), else 4, as the design's tokens do.
 */
export function displayDecimals(decimals: number, price: number): number {
    const dp = price >= 1000 ? 8 : price > 0.9 && price < 1.1 ? 2 : 4;
    return Math.min(dp, decimals);
}

/**
 * The library's actions from the wallet's (tokenActions): Remove is the panel's Hide. Swap isn't
 * offered until its flow is built (6c).
 */
export function walletTokenActions(actions: TokenAction[]): WalletTokenAction[] {
    return actions.flatMap((a): WalletTokenAction[] => {
        switch (a) {
            case "refresh":
                return ["refresh"];
            case "send":
                return ["send"];
            case "receive":
                return ["receive"];
            case "remove":
                return ["hide"];
            default:
                return [];
        }
    });
}

/**
 * The networks Send can send a token on, as the library names them: the IC (an ICRC account, or
 * an ICP account identifier for ICP) and, for BTC, Bitcoin's own (`sendNetworks`).
 */
export function sendTokenNets(symbol: string): string[] {
    return [...new Set(sendNetworks(symbol).map((n) => (n === "icrc" ? "icp" : n)))];
}

/**
 * A token as the wallet lists it, identified by its ledger (invariant 1: two tokens can share a
 * symbol). Its face is its logo; its colour (in the bars, and behind a missing logo) the swatch its
 * ledger picks.
 */
export function walletToken(
    token: EnhancedTokenDetails,
    price: number | undefined,
    actions: TokenAction[],
): WalletToken {
    const usd = price ?? 0;
    return {
        id: token.ledger,
        symbol: token.symbol,
        name: token.name,
        mark: token.symbol.slice(0, 1),
        grad: AVATAR_GRADIENTS[swatchFor(token.ledger)],
        logo: token.logo || undefined,
        held: wholeTokens(token.balance, token.decimals),
        price: usd,
        dp: displayDecimals(token.decimals, usd),
        fee: wholeTokens(token.transferFee, token.decimals),
        // a send to a user is a transfer pulled from the wallet once approved: the approval's fee too
        userFee: wholeTokens(
            token.transferFee + walletApprovalFee(token.transferFee),
            token.decimals,
        ),
        nets: sendTokenNets(token.symbol),
        ledger: token.ledger,
        standard: tokenStandard(token.supportedStandards),
        actions: walletTokenActions(actions),
    };
}

/**
 * The wallet's catalogue as the panel and the token page list it: every token it can receive or
 * holds (`cryptoTokensSorted`), each with its price and what it offers. Never CHIT, which isn't a
 * token.
 */
export function walletTokens(
    catalogue: EnhancedTokenDetails[],
    rates: { get(ledger: string): TokenExchangeRates | undefined },
    actions: TokenActionsContext,
): WalletToken[] {
    return catalogue.map((token) =>
        walletToken(token, rates.get(token.ledger)?.toUSD, tokenActions(token, actions)),
    );
}

/** How many tokens the wallet can receive: the catalogue, one per ledger, as the Supported tokens picker lists it. */
export function supportedCount(tokens: Pick<WalletToken, "id" | "symbol">[]): number {
    return new Set(tokens.map((t) => t.id ?? t.symbol)).size;
}

/**
 * The wallet config as the panel reads it: automatic lists what you own worth at least the
 * minimum (the rest folded into small balances); manual lists the chosen tokens, by ledger.
 */
export function panelSettings(config: WalletConfig): WalletPanelSettings {
    return config.kind === "auto_wallet"
        ? { autoConfig: true, minBalance: String(config.minDollarValue) }
        : { autoConfig: false, tokens: [...config.tokens] };
}

/** Who's on the other side of the user's transactions. */
export type ActivityContext = {
    me: MyWallets;
    users: UserLookup;
    saved: readonly NamedAccount[];
    /** The other side's name when there's none (a mint has no sender, a burn no recipient). */
    unknown: string;
};

/**
 * A token's history as activity rows, newest first: received, sent, or between the user's own
 * wallets (invariant 2), with the other side's name for the library to word the title.
 */
export function tokenActivity(
    transactions: AccountTransaction[],
    token: Pick<EnhancedTokenDetails, "ledger" | "symbol" | "decimals">,
    price: number | undefined,
    ctx: ActivityContext,
): WalletActivity[] {
    return transactions.map((tx) => {
        const direction = transactionDirection(tx, ctx.me);
        const amount = wholeTokens(tx.amount, token.decimals);
        return {
            id: tx.id.toString(),
            symbol: token.symbol,
            token: token.ledger,
            kind: direction === "own" ? "own" : direction === "out" ? "send" : "receive",
            party:
                counterpartyName(transactionCounterparty(tx, ctx.me, ctx.users, ctx.saved)) ??
                ctx.unknown,
            timestamp: tx.timestamp.getTime(),
            amount,
            fiat: amount * (price ?? 0),
        };
    });
}

// a network's name as Receive shows it
const NETWORK_NAMES: Record<string, string> = {
    BTC: "Bitcoin",
    SOL: "Solana",
    ICP: "Internet Computer",
};

/** Where a token is received, as ReceiveAccount works it out. */
export type ReceiveState = {
    networks: string[];
    selectedNetwork: string | undefined;
    address: string | undefined;
    failed: boolean;
    depositNote: DepositNote;
    arrivingToken(network: string): string | undefined;
};

/**
 * Receive's networks for a token: ReceiveAccount's (BTC or ckBTC, SOL or ckSOL, oneSec's chains),
 * or the Internet Computer alone for an IC token. The chosen one carries the address (or that it's
 * still coming, or failed) and what depositing there costs, in the app's words.
 */
export function receiveNetworks(
    state: ReceiveState,
    symbol: string,
    translate: (key: string, values: Record<string, string>) => string,
): ReceiveNetwork[] {
    const names = state.networks.length > 0 ? state.networks : ["ICP"];
    const selected = state.selectedNetwork ?? names[0];
    return names.map((id) => {
        // the warning names what the address takes: ckBTC on the ckBTC network (ReceiveAccount)
        const network: ReceiveNetwork = {
            id,
            label: NETWORK_NAMES[id] ?? id,
            token: state.arrivingToken(id),
        };
        if (id !== selected) return network;
        return {
            ...network,
            address: state.address,
            failed: state.failed,
            note: depositNoteText(state.depositNote, symbol, translate),
        };
    });
}

function depositNoteText(
    note: DepositNote,
    symbol: string,
    translate: (key: string, values: Record<string, string>) => string,
): string | undefined {
    switch (note.kind) {
        case "none":
            return undefined;
        case "loading":
            return translate("cryptoAccount.fetchingDepositFee", {});
        case "failed":
            return translate("cryptoAccount.failedToFetchDepositFee", {});
        case "btc":
        case "one_sec":
            return translate("cryptoAccount.networkFee", { amount: note.fee, token: symbol });
        case "sol": {
            const fees = translate("cryptoAccount.solDepositFee", {
                first: note.firstFee,
                subsequent: note.laterFee,
                token: symbol,
            });
            return note.minimum === undefined
                ? fees
                : `${translate("cryptoAccount.minimumDeposit", { amount: note.minimum, token: symbol })} ${fees}`;
        }
    }
}

/**
 * The people Send offers: the users the user has DM'd (`directChatUsers`), as mobile's Send to a
 * user does. Tokens sent to anyone else would start a chat they never asked for.
 */
export function sendContacts(users: UserSummary[]): SendContact[] {
    return users.map((u) => ({
        userId: u.userId,
        name: u.displayName ?? u.username,
        handle: `@${u.username}`,
        grad: AVATAR_GRADIENTS[swatchFor(u.userId)],
    }));
}

/**
 * The address book as WalletRecipients lists it: each saved account, keyed by its account (the
 * canister's key; a recipient has no id of its own).
 */
export function walletRecipients(accounts: NamedAccount[]): Recipient[] {
    return accounts.map((a) => ({ id: a.account, name: a.name, address: a.account }));
}

const ADDRESS_NETWORK_NAMES: Record<AddressNetwork, string> = {
    icrc: "Internet Computer",
    icp: "Internet Computer",
    btc: "Bitcoin",
    eth: "Ethereum",
    sol: "Solana",
};

/** The name of the network an address is on, as the recipients' rows show it. */
export function addressNetworkName(network: AddressNetwork): string {
    return ADDRESS_NETWORK_NAMES[network];
}
