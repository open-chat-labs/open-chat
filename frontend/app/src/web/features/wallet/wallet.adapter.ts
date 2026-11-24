// The web wallet's Receive, Send and recipients in the library's shapes. The tokens and a token's
// history as activity rows, which the native wallet lists too, are logic/wallet/walletTokens'.
import type { NamedAccount, UserSummary } from "@client";
import type { ReceiveNetwork } from "@openchat/ui/src/features/components/WalletReceive.svelte";
import type { SendContact } from "@openchat/ui/src/features/components/WalletSend.svelte";
import type { DepositNote } from "@src/logic/wallet/receiveAccount.svelte";
import type { Recipient } from "@openchat/ui/src/features/components/WalletRecipients.svelte";
import { addressNetwork, type AddressNetwork } from "@src/utils/cryptoAddress";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/avatarGradients";
import { swatchFor } from "@src/logic/swatch";

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

/** The ledgers Send can open on for a saved address: ICP's, and BTC's and ckSOL's when the app has them. */
export type RecipientLedgers = { icp: string; btc?: string; sol?: string };

/**
 * The address book as WalletRecipients lists it: each saved account, keyed by its account (the
 * canister's key; a recipient has no id of its own), with its network's name and the token Send
 * opens on: BTC for a Bitcoin address, ckSOL for a Solana one, else ICP.
 */
export function walletRecipients(accounts: NamedAccount[], ledgers: RecipientLedgers): Recipient[] {
    return accounts.map((a) => {
        const network = addressNetwork(a.account);
        const sendToken =
            network === "btc" ? ledgers.btc : network === "sol" ? ledgers.sol : undefined;
        return {
            id: a.account,
            name: a.name,
            address: a.account,
            networkName: network === undefined ? undefined : addressNetworkName(network),
            sendToken: sendToken ?? ledgers.icp,
        };
    });
}

/**
 * Send's user search: the people it offers (`sendContacts`, the users already DM'd) whose name or
 * handle has the query in it, ignoring case and a leading "@".
 */
export function searchContacts(contacts: SendContact[], query: string): SendContact[] {
    const needle = query.trim().replace(/^@/, "").toLowerCase();
    if (needle === "") return [];
    return contacts.filter(
        (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.handle.replace(/^@/, "").toLowerCase().includes(needle),
    );
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
