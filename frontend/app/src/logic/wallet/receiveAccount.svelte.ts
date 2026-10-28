import {
    BTC_SYMBOL,
    CKBTC_SYMBOL,
    CKSOL_SYMBOL,
    FIRST_SOL_DEPOSIT_FEE,
    formatTokens,
    ICP_SYMBOL,
    LEDGER_CANISTER_CKSOL,
    SOL_DEPOSIT_FEE,
    SOL_SYMBOL,
    type CryptocurrencyDetails,
    type OneSecTransferFees,
    type OpenChat,
} from "@client";
import { untrack } from "svelte";
import { userWalletAddress } from "./receiveAddress";

/** The token being received: what decides its networks and its address. */
export type ReceiveToken = Pick<
    CryptocurrencyDetails,
    "ledger" | "symbol" | "decimals" | "oneSecEnabled" | "evmContractAddresses"
>;

/** The user's own wallets: the ICP account, and their user id and principal for the ICRC account. */
export type ReceiveOwner = { cryptoAccount: string; userId: string; principal: () => string };

/**
 * What the network's deposit costs or needs, as each tree words it: the ckBTC minter's fee (an
 * estimate), the ckSOL minter's minimum and the fixed SOL deposit fees, or oneSec's fee (a share
 * plus an estimated transfer fee). Amounts are formatted in the token's units.
 */
export type DepositNote =
    | { kind: "none" }
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "btc"; fee: string }
    | { kind: "sol"; minimum: string | undefined; firstFee: string; laterFee: string }
    | { kind: "one_sec"; fee: string };

/** Something fetched once it has arrived; a failure is asked for again. */
type Fetched<T> = { kind: "loaded"; value: T } | { kind: "failed" };

type Client = Pick<
    OpenChat,
    | "getBtcAddress"
    | "getSolAddress"
    | "getOneSecAddress"
    | "getCkbtcMinterDepositInfo"
    | "getCksolMinterDepositInfo"
    | "oneSecGetTransferFees"
    | "oneSecGetNetworks"
>;

/**
 * Where the user receives a token, for every tree's Receive: the networks it arrives on (BTC or
 * ckBTC, SOL or ckSOL, oneSec's chains), the one chosen (the first, unless the user picks another
 * that's still offered), the address on it and what depositing there costs. ICP arrives at the
 * user's ICP account and every other IC token at their wallet's ICRC account, never the bare user
 * id (invariant 6); the BTC, SOL and oneSec addresses are fetched. It starts effects, so it must
 * be built while a component initialises.
 */
export class ReceiveAccount {
    #client: Client;
    #token: () => ReceiveToken;
    #owner: () => ReceiveOwner;
    // the network the user picked, for the token it was picked for
    #chosen = $state<{ ledger: string; network: string }>();
    #fetched = $state<Partial<Record<"btc" | "sol" | "one_sec", string>>>({});
    #failed = $state<Partial<Record<"btc" | "sol" | "one_sec", boolean>>>({});
    #btcFee = $state<DepositNote>({ kind: "loading" });
    #solMinimum = $state<Fetched<string>>();
    #oneSecFees = $state<Fetched<OneSecTransferFees[]>>();

    #isBtc = $derived.by(() => this.#token().symbol === BTC_SYMBOL);
    #isSol = $derived.by(() => this.#token().ledger === LEDGER_CANISTER_CKSOL);
    #oneSecEnabled = $derived.by(
        () => this.#token().oneSecEnabled && this.#token().evmContractAddresses.length > 0,
    );
    #networks = $derived.by((): string[] => {
        if (this.#isBtc) return [BTC_SYMBOL, CKBTC_SYMBOL];
        if (this.#isSol) return [SOL_SYMBOL, CKSOL_SYMBOL];
        if (this.#oneSecEnabled) return this.#client.oneSecGetNetworks(this.#token().symbol);
        return [];
    });
    // the first network whenever the list changes, unless the user has picked one still in it
    // for this token (a pick for another token doesn't carry over)
    #selected = $derived.by(() => {
        const chosen = this.#chosen;
        return chosen !== undefined &&
            chosen.ledger === this.#token().ledger &&
            this.#networks.includes(chosen.network)
            ? chosen.network
            : this.#networks[0];
    });
    // which deposit address the chosen network needs fetched, if any
    #remote = $derived.by((): "btc" | "sol" | "one_sec" | undefined => {
        if (this.#selected === BTC_SYMBOL) return "btc";
        if (this.#selected === SOL_SYMBOL) return "sol";
        if (this.#oneSecEnabled && this.#selected !== ICP_SYMBOL) return "one_sec";
        return undefined;
    });

    constructor(client: Client, token: () => ReceiveToken, owner: () => ReceiveOwner) {
        this.#client = client;
        this.#token = token;
        this.#owner = owner;

        // another token starts again from its first network, even when it comes back later
        $effect(() => {
            const ledger = this.#token().ledger;
            untrack(() => {
                if (this.#chosen !== undefined && this.#chosen.ledger !== ledger) {
                    this.#chosen = undefined;
                }
            });
        });

        // a deposit address is fetched the first time its network is chosen
        $effect(() => {
            const remote = this.#remote;
            if (remote === undefined || this.#fetched[remote] !== undefined) return;
            untrack(() => this.#fetch(remote));
        });

        // and what depositing on it costs
        $effect(() => {
            const selected = this.#selected;
            const remote = this.#remote;
            untrack(() => {
                if (selected === BTC_SYMBOL) this.#loadBtcFee();
                else if (selected === SOL_SYMBOL) this.#loadSolMinimum();
                else if (remote === "one_sec") this.#loadOneSecFees();
            });
        });
    }

    get networks(): string[] {
        return this.#networks;
    }

    get selectedNetwork(): string | undefined {
        return this.#selected;
    }

    set selectedNetwork(network: string | undefined) {
        this.#chosen =
            network === undefined ? undefined : { ledger: this.#token().ledger, network };
    }

    /** The address to receive at on the chosen network; undefined while it's being fetched. */
    get address(): string | undefined {
        const remote = this.#remote;
        if (remote !== undefined) return this.#fetched[remote];
        const owner = this.#owner();
        // ICP arrives at the ICP account; every other IC token at the wallet's ICRC account
        return this.#token().symbol === ICP_SYMBOL
            ? owner.cryptoAccount
            : userWalletAddress(owner.userId, owner.principal);
    }

    /** The chosen network's address couldn't be fetched. */
    get failed(): boolean {
        const remote = this.#remote;
        return remote !== undefined && !!this.#failed[remote];
    }

    /** What depositing on the chosen network costs or needs. */
    get depositNote(): DepositNote {
        const decimals = this.#token().decimals;
        if (this.#selected === BTC_SYMBOL) return this.#btcFee;
        if (this.#selected === SOL_SYMBOL) {
            return {
                kind: "sol",
                minimum: this.#solMinimum?.kind === "loaded" ? this.#solMinimum.value : undefined,
                firstFee: formatTokens(FIRST_SOL_DEPOSIT_FEE, decimals),
                laterFee: formatTokens(SOL_DEPOSIT_FEE, decimals),
            };
        }
        if (this.#remote === "one_sec") return this.#oneSecNote(decimals);
        return { kind: "none" };
    }

    #oneSecNote(decimals: number): DepositNote {
        const fetched = this.#oneSecFees;
        if (fetched === undefined) return { kind: "loading" };
        if (fetched.kind === "failed") return { kind: "failed" };
        const fees = fetched.value;
        const symbol = this.#token().symbol;
        const network = this.#selected;
        const forToken = fees.filter((f) => f.sourceToken === symbol);
        const protocol = forToken.find(
            (f) => f.sourceChain === network && f.destinationChain === ICP_SYMBOL,
        )?.protocolFeePercent;
        const transfer = forToken.find(
            (f) => f.sourceChain === ICP_SYMBOL && f.destinationChain === network,
        )?.latestTransferFee;
        if (protocol === undefined || transfer === undefined) return { kind: "failed" };
        return {
            kind: "one_sec",
            fee: `${protocol}% + ~${formatTokens(transfer, decimals)}`,
        };
    }

    async #fetch(remote: "btc" | "sol" | "one_sec"): Promise<void> {
        this.#failed = { ...this.#failed, [remote]: false };
        try {
            const address =
                remote === "btc"
                    ? await this.#client.getBtcAddress()
                    : remote === "sol"
                      ? await this.#client.getSolAddress()
                      : await this.#client.getOneSecAddress();
            this.#fetched = { ...this.#fetched, [remote]: address };
        } catch (err) {
            console.warn(`Couldn't get the ${remote} deposit address`, err);
            this.#failed = { ...this.#failed, [remote]: true };
        }
    }

    #btcFeeLoading = false;
    async #loadBtcFee(): Promise<void> {
        if (this.#btcFeeLoading || this.#btcFee.kind === "btc") return;
        this.#btcFeeLoading = true;
        try {
            const info = await this.#client.getCkbtcMinterDepositInfo();
            this.#btcFee = { kind: "btc", fee: `~${formatTokens(info.depositFee, 8)}` };
        } catch {
            this.#btcFee = { kind: "failed" };
        } finally {
            this.#btcFeeLoading = false;
        }
    }

    // a minimum or fees that failed are asked for again the next time they're needed
    #solMinimumLoading = false;
    async #loadSolMinimum(): Promise<void> {
        if (this.#solMinimumLoading || this.#solMinimum?.kind === "loaded") return;
        this.#solMinimumLoading = true;
        try {
            const info = await this.#client.getCksolMinterDepositInfo();
            this.#solMinimum = {
                kind: "loaded",
                value: formatTokens(info.minimumDepositAmount, this.#token().decimals),
            };
        } catch {
            // the minimum is only informational
            this.#solMinimum = { kind: "failed" };
        } finally {
            this.#solMinimumLoading = false;
        }
    }

    #oneSecLoading = false;
    async #loadOneSecFees(): Promise<void> {
        if (this.#oneSecLoading || this.#oneSecFees?.kind === "loaded") return;
        this.#oneSecLoading = true;
        try {
            const fees = await this.#client.oneSecGetTransferFees();
            // cross-chain deposits: the source token is the destination token
            const value = fees.filter((f) => f.sourceToken === f.destinationToken);
            this.#oneSecFees = { kind: "loaded", value };
        } catch {
            this.#oneSecFees = { kind: "failed" };
        } finally {
            this.#oneSecLoading = false;
        }
    }
}
