import { toastStore } from "@src/stores/toast";
import {
    cryptoBalanceStore,
    currentUserStore,
    exchangeRatesLookupStore,
    formatTokens,
    getConvertedBalances,
    i18nKey,
    ICP_SYMBOL,
    OpenChat,
    type ConvertedBalances,
    type EnhancedTokenDetails,
} from "openchat-client";

export type ConversionToken = "usd" | "icp" | "btc" | "eth";

export function getConvertedTokenValue(
    c: ConversionToken,
    t: ConvertedBalances,
): number | undefined {
    switch (c) {
        case "usd":
            return t.dollarBalance;
        case "icp":
            return t.icpBalance;
        case "btc":
            return t.btcBalance;
        case "eth":
            return t.ethBalance;
    }
}

export function formatConvertedValue(c: ConversionToken, val?: number): string {
    switch (c) {
        case "usd":
            if (val !== undefined) {
                return `$${val.toFixed(2)}`;
            }
            return "???";
        case "icp":
            return val?.toFixed(3) ?? "???";
        case "btc":
            return val?.toFixed(6) ?? "???";
        case "eth":
            return val?.toFixed(6) ?? "???";
    }
}

export function convertAndFormat(c: ConversionToken, t: EnhancedTokenDetails): string {
    return formatConvertedValue(c, getConvertedTokenValue(c, t));
}

const nullToken: EnhancedTokenDetails = {
    name: "",
    symbol: "",
    ledger: "",
    index: undefined,
    decimals: 0,
    transferFee: 0n,
    logo: "",
    infoUrl: "",
    transactionUrlFormat: "",
    supportedStandards: [],
    added: 0n,
    enabled: false,
    oneSecEnabled: false,
    evmContractAddresses: [],
    lastUpdated: 0n,
    balance: 0n,
    dollarBalance: undefined,
    icpBalance: undefined,
    btcBalance: undefined,
    ethBalance: undefined,
    zero: false,
    urlFormat: "",
};

export class TokenState {
    #refreshingBalance = $state(false);
    #selectedConversion = $state<ConversionToken>("usd");
    #token = $state<EnhancedTokenDetails>(nullToken);
    #enabled = $derived(this.#token.enabled);
    #urlFormat = $derived(this.#token.urlFormat);
    #decimals = $derived(this.#token.decimals);
    #logo = $derived(this.#token.logo);
    #minAmount = $derived(this.#token.transferFee * 10n);
    #minAmountLabel = $derived(Number(this.#minAmount) / Math.pow(10, this.#decimals));
    #ledger = $derived(this.#token.ledger);
    #draftAmount = $state(this.#minAmount);
    #symbol = $derived(this.#token.symbol);
    #cryptoBalance = $derived(cryptoBalanceStore.value.get(this.#ledger) ?? 0n);
    #transferFees = $derived(this.#token.transferFee);
    #remainingBalance = $derived(
        this.#draftAmount > BigInt(0)
            ? this.#cryptoBalance - this.#draftAmount - this.#transferFees
            : this.#cryptoBalance,
    );
    #convertedBalances = $derived(
        getConvertedBalances(
            exchangeRatesLookupStore.value,
            this.#remainingBalance,
            this.#decimals,
            this.#symbol,
        ),
    );
    #formattedTokenBalance = $derived(formatTokens(this.#remainingBalance, this.#decimals));
    #convertedValue = $derived(
        getConvertedTokenValue(this.#selectedConversion, this.#convertedBalances),
    );
    #formattedConvertedValue = $derived(
        formatConvertedValue(this.#selectedConversion, this.#convertedValue),
    );
    #usdRate(symbol: string) {
        if (symbol === "usd") return 1;
        return exchangeRatesLookupStore.value.get(symbol.toLowerCase())?.toUSD;
    }

    #formattedUnitValue = $derived.by(() => {
        const conversion = this.#usdRate(this.#selectedConversion.toLowerCase());
        const token = this.#usdRate(this.#symbol);
        if (conversion === undefined || token === undefined || conversion === 0) return "?????";
        return formatConvertedValue(this.#selectedConversion, token / conversion);
    });
    #account = $derived.by(() => {
        if (this.#token.symbol === ICP_SYMBOL) {
            return currentUserStore.value.cryptoAccount;
        } else {
            return currentUserStore.value.userId;
        }
    });

    constructor(t: EnhancedTokenDetails, c: ConversionToken = "usd") {
        this.#token = t;
        this.#selectedConversion = c;
    }

    formatTokens(amount: bigint) {
        return formatTokens(amount, this.#decimals);
    }

    formatConvertedTokens(amount: bigint) {
        return formatConvertedValue(
            this.#selectedConversion,
            getConvertedTokenValue(
                this.#selectedConversion,
                getConvertedBalances(
                    exchangeRatesLookupStore.value,
                    amount,
                    this.#decimals,
                    this.#symbol,
                ),
            ),
        );
    }

    get account() {
        return this.#account;
    }

    get remainingBalance() {
        return this.#remainingBalance;
    }

    get urlFormat() {
        return this.#urlFormat;
    }

    get enabled() {
        return this.#enabled;
    }

    get logo() {
        return this.#logo;
    }

    get decimals() {
        return this.#decimals;
    }

    get symbol() {
        return this.#symbol;
    }

    get transferFees() {
        return this.#transferFees;
    }

    get maxAmount() {
        return this.#cryptoBalance - this.#transferFees;
    }

    get cryptoBalance() {
        return this.#cryptoBalance;
    }

    get ledger() {
        return this.#ledger;
    }

    get minAmount() {
        return this.#minAmount;
    }

    get minAmountLabel() {
        return this.#minAmountLabel;
    }

    get draftAmount() {
        return this.#draftAmount;
    }

    set draftAmount(val: bigint) {
        this.#draftAmount = val;
    }

    get formattedUnitValue(): string {
        return this.#formattedUnitValue;
    }

    get formattedConvertedValue(): string {
        return this.#formattedConvertedValue;
    }

    get formattedTokenBalance(): string {
        return this.#formattedTokenBalance;
    }

    get token(): EnhancedTokenDetails {
        return this.#token;
    }

    get selectedConversion(): ConversionToken {
        if (this.#selectedConversion === undefined) {
            throw new Error("Trying to access selected conversion before it has been initialised");
        }
        return this.#selectedConversion;
    }

    set token(val: EnhancedTokenDetails) {
        this.#token = val;
    }

    get refreshingBalance() {
        return this.#refreshingBalance;
    }

    set selectedConversion(val: ConversionToken) {
        this.#selectedConversion = val;
    }

    refreshBalance(client: OpenChat) {
        this.#refreshingBalance = true;
        return client
            .refreshAccountBalance(this.ledger, false)
            .catch((_) => {
                toastStore.showFailureToast(
                    i18nKey("unableToRefreshAccountBalance", { token: this.symbol }),
                );
            })
            .finally(() => (this.#refreshingBalance = false));
    }
}
