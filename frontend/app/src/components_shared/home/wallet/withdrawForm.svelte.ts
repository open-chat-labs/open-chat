import {
    BTC_SYMBOL,
    CKBTC_SYMBOL,
    currentUserIdStore,
    currentUserStore,
    ICP_SYMBOL,
    Lazy,
    type CkbtcMinterWithdrawalInfo,
    type EvmChain,
    type OneSecTransferFees,
    type OpenChat,
    type WithdrawalRoute,
    type WithdrawOutcome,
} from "@client";
import {
    encodeIcrcAccount,
    isAccountIdentifierValid,
    isICRCAddressValid,
    userWalletAccount,
} from "@shared";
import { CkbtcWithdrawalInfoRequests } from "@src/utils/ckbtcWithdrawalInfo";
import type { TokenState } from "./walletState.svelte";

/**
 * The state of a form sending a token from the user's wallet to an address: the network it goes over,
 * the address, and the minimum amount and network fee those imply. The amount is the TokenState's draft.
 * Both trees render it. It starts effects, so it must be built while a component initialises.
 */
export class WithdrawForm {
    #client: OpenChat;
    #tokenState: TokenState;
    // The user's own wallet, which they can't send to
    #ownAccount: string;
    #chosenNetwork = $state<string>();
    #ckbtcInfo = $state<CkbtcMinterWithdrawalInfo>();
    #oneSecFees = $state<OneSecTransferFees[]>();
    #ckbtcInfoRequests: CkbtcWithdrawalInfoRequests;
    #oneSecFeesPromise: Lazy<Promise<OneSecTransferFees[]>>;

    targetAccount = $state("");
    // Whether the amount is valid, as the amount input reports it
    validAmount = $state(false);

    #isBtc = $derived.by(() => this.#tokenState.symbol === BTC_SYMBOL);
    #oneSecEnabled = $derived.by(
        () =>
            this.#tokenState.token.oneSecEnabled &&
            this.#tokenState.token.evmContractAddresses.length > 0,
    );
    #networks = $derived.by(() => {
        if (this.#isBtc) return [BTC_SYMBOL, CKBTC_SYMBOL];
        if (this.#oneSecEnabled) return this.#client.oneSecGetNetworks(this.#tokenState.symbol);
        return [];
    });
    // The first network unless the user has picked another
    #selectedNetwork = $derived.by(() =>
        this.#chosenNetwork !== undefined && this.#networks.includes(this.#chosenNetwork)
            ? this.#chosenNetwork
            : this.#networks[0],
    );
    #isBtcNetwork = $derived.by(() => this.#selectedNetwork === BTC_SYMBOL);
    #isOneSecNetwork = $derived.by(
        () => this.#oneSecEnabled && this.#selectedNetwork !== ICP_SYMBOL,
    );
    // Refused whichever way the send is made, since anything sent there would be lost
    #targetIsUserIdAccount = $derived.by(() =>
        this.#client.isAccountOfMultiUserCanisterUserId(this.targetAccount),
    );
    #targetAccountValid = $derived.by(() => {
        const target = this.targetAccount;
        if (target.length === 0 || target === this.#ownAccount) return false;
        // Checked before the network, since BTC sent over the ckBTC network goes to an IC account
        if (this.#targetIsUserIdAccount) return false;
        if (this.#isBtc) return target.length >= 14;
        if (this.#isOneSecNetwork) return target.length === 42;
        if (isICRCAddressValid(target)) return true;
        return this.#tokenState.symbol === ICP_SYMBOL && isAccountIdentifierValid(target);
    });
    #oneSecFeesForToken = $derived.by(() => {
        if (!this.#isOneSecNetwork || this.#oneSecFees === undefined) return undefined;
        return this.#oneSecFees.find(
            (f) =>
                f.sourceToken === this.#tokenState.symbol &&
                f.destinationChain === this.#selectedNetwork,
        );
    });
    #minAmount = $derived.by(() => {
        if (this.#isBtcNetwork && this.#ckbtcInfo !== undefined) {
            return this.#ckbtcInfo.minWithdrawalAmount;
        }
        if (this.#isOneSecNetwork && this.#oneSecFeesForToken !== undefined) {
            return this.#oneSecFeesForToken.minAmount;
        }
        return 0n;
    });
    #networkFee = $derived.by(() => {
        if (this.#isBtcNetwork && this.#ckbtcInfo !== undefined) {
            return this.#ckbtcInfo.feeEstimate;
        }
        if (this.#isOneSecNetwork && this.#oneSecFeesForToken !== undefined) {
            const fees = this.#oneSecFeesForToken;
            return (
                fees.latestTransferFee +
                (this.#tokenState.draftAmount * BigInt(100 * fees.protocolFeePercent)) / 10000n
            );
        }
        return undefined;
    });
    // On the BTC network the minimum amount isn't known until the ckBTC minter has answered
    #canSend = $derived.by(
        () =>
            this.validAmount &&
            this.#targetAccountValid &&
            (!this.#isBtcNetwork || this.#ckbtcInfo !== undefined),
    );

    constructor(client: OpenChat, tokenState: TokenState) {
        this.#client = client;
        this.#tokenState = tokenState;
        this.#ownAccount =
            tokenState.symbol === ICP_SYMBOL
                ? currentUserStore.value.cryptoAccount
                : encodeIcrcAccount(
                      userWalletAccount(currentUserIdStore.value, () => client.OcIdentityPrincipal),
                  );
        this.#ckbtcInfoRequests = new CkbtcWithdrawalInfoRequests(
            (amount) => client.getCkbtcMinterWithdrawalInfo(amount),
            (info) => (this.#ckbtcInfo = info),
        );
        // Filtered to where the source token is the destination token, since these are cross-chain
        // withdrawals
        this.#oneSecFeesPromise = new Lazy(() =>
            client
                .oneSecGetTransferFees()
                .then((fees) =>
                    fees.filter(
                        (f) => f.sourceToken === f.destinationToken && f.sourceChain === ICP_SYMBOL,
                    ),
                ),
        );

        if (this.#isBtc) {
            this.#ckbtcInfoRequests.now(0n);
        }

        $effect(() => {
            if (this.#isBtcNetwork) {
                this.#ckbtcInfoRequests.debounced(this.#tokenState.draftAmount);
            } else if (this.#isOneSecNetwork) {
                this.#oneSecFeesPromise.get().then((fees) => (this.#oneSecFees = fees));
            }
        });

        $effect(() => () => this.#ckbtcInfoRequests.cancel());
    }

    get networks(): string[] {
        return this.#networks;
    }

    get selectedNetwork(): string | undefined {
        return this.#selectedNetwork;
    }

    set selectedNetwork(network: string | undefined) {
        this.#chosenNetwork = network;
    }

    get targetIsUserIdAccount(): boolean {
        return this.#targetIsUserIdAccount;
    }

    get targetAccountValid(): boolean {
        return this.#targetAccountValid;
    }

    get minAmount(): bigint {
        return this.#minAmount;
    }

    get networkFee(): bigint | undefined {
        return this.#networkFee;
    }

    get networkFeeFormatted(): string | undefined {
        return this.#networkFee === undefined
            ? undefined
            : `~${this.#client.formatTokens(this.#networkFee, this.#tokenState.decimals)}`;
    }

    get canSend(): boolean {
        return this.#canSend;
    }

    send(): Promise<WithdrawOutcome> {
        return this.#client.withdraw({
            ledger: this.#tokenState.ledger,
            symbol: this.#tokenState.symbol,
            route: this.route,
            to: this.targetAccount,
            amount: this.#tokenState.draftAmount,
            fee: this.#tokenState.transferFee,
        });
    }

    get route(): WithdrawalRoute {
        if (this.#isBtcNetwork) return { kind: "btc" };
        if (this.#isOneSecNetwork) {
            return { kind: "one_sec", chain: this.#selectedNetwork as EvmChain };
        }
        return { kind: "ledger" };
    }
}
