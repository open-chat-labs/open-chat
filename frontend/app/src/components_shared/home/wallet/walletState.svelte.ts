import { toastStore } from "@src/stores/toast";
import {
    conversionLedgers,
    cryptoBalanceStore,
    exchangeRatesLookupStore,
    formatTokens,
    getConvertedBalances,
    i18nKey,
    OpenChat,
    type ConvertedBalances,
    type EnhancedTokenDetails,
} from "@client";
import { reactiveValue } from "@src/utils/reactiveValue";

export type ConversionToken = "usd" | "icp" | "btc" | "eth";

function conversionToUSD(c: ConversionToken): number | undefined {
    if (c === "usd") return 1;
    return rates().get(conversionLedgers[c])?.toUSD;
}

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

/* Trying to find a formatting algo that seems to make sense for all values
 *  - values > 1 we fix to 2dp.
 *  - small values we show the first significant digits up to a max of 8 so it works for very
 *    low value tokens
 */
function formatDecimals(val?: number, max = 8) {
    if (val === undefined) return undefined;

    if (val === 0) return "0.00";

    const abs = Math.abs(val);

    // Large-ish numbers: fixed 2dp
    if (abs >= 1) {
        return val.toFixed(2);
    }

    // Small numbers: show significance, up to max dp
    // Find first non-zero decimal digit
    const order = Math.floor(Math.log10(abs)); // negative
    const decimals = Math.min(max, Math.max(2, -order + 1));

    return val.toFixed(decimals);
}

export function formatConvertedValue(c: ConversionToken, val?: number): string {
    switch (c) {
        case "usd":
            if (val !== undefined) {
                return `$${formatDecimals(val)}`;
            }
            return "???";
        default:
            return formatDecimals(val) ?? "???";
    }
}

// export function formatConvertedValue(c: ConversionToken, val?: number): string {
//     switch (c) {
//         case "usd":
//             if (val !== undefined) {
//                 return `$${val.toFixed(2)}`;
//             }
//             return "???";
//         case "icp":
//             return val?.toFixed(3) ?? "???";
//         case "btc":
//             return val?.toFixed(6) ?? "???";
//         case "eth":
//             return val?.toFixed(6) ?? "???";
//     }
// }

export function convertAndFormat(c: ConversionToken, t: EnhancedTokenDetails): string {
    return formatConvertedValue(c, getConvertedTokenValue(c, t));
}

const balances = reactiveValue(cryptoBalanceStore);
const rates = reactiveValue(exchangeRatesLookupStore);

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
    #cryptoBalance = $derived(balances().get(this.#ledger) ?? 0n);
    #transferFee = $derived(this.#token.transferFee);
    // What the draft costs in fees. One transfer's fee unless the flow sets otherwise, eg. to add
    // the approval the wallet makes before a payment is pulled from it (see `walletApprovalFee`)
    #fees = $state<bigint | undefined>();
    #transferFees = $derived(this.#fees ?? this.#transferFee);
    #remainingBalance = $derived(
        this.#draftAmount > BigInt(0)
            ? this.#cryptoBalance - this.#draftAmount - this.#transferFees
            : this.#cryptoBalance,
    );
    #convertedBalances = $derived(
        getConvertedBalances(rates(), this.#remainingBalance, this.#decimals, this.#ledger),
    );
    #formattedTokenBalance = $derived(this.formatTokens(this.#remainingBalance));
    #convertedValue = $derived(
        getConvertedTokenValue(this.#selectedConversion, this.#convertedBalances),
    );
    #formattedConvertedValue = $derived(
        formatConvertedValue(this.#selectedConversion, this.#convertedValue),
    );
    #formattedUnitValue = $derived.by(() => {
        const conversion = conversionToUSD(this.#selectedConversion);
        const token = rates().get(this.#ledger)?.toUSD;
        if (conversion === undefined || token === undefined || conversion === 0) return "?????";
        return formatConvertedValue(this.#selectedConversion, token / conversion);
    });

    // Every caller looks the token up in the registry and asserts the result is there. It is not
    // always: a message or an access gate can name a ledger the registry has never carried or has
    // since dropped, and an undefined token here took the whole app down on the first derived read
    // of `#token.ledger`. The null token stops the crash, but its zero decimals and empty symbol
    // would render an amount that is wrong rather than obviously missing, so callers must consult
    // `unknown` and refuse to show a figure or offer an action for a token we cannot identify.
    // A plain boolean, deliberately. `#token` is `$state`, and Svelte proxies whatever is assigned
    // to it, so `this.#token === nullToken` compares a proxy with the raw object and is always
    // false - which made every guard keyed on it inert. Set wherever `#token` is.
    #unknown = false;

    constructor(t: EnhancedTokenDetails | undefined, c: ConversionToken = "usd") {
        this.#token = t ?? nullToken;
        this.#unknown = t === undefined;
        this.#selectedConversion = c;
    }

    // True when the ledger is not in the registry: nothing about this token can be trusted,
    // including any amount formatted with it.
    get unknown() {
        return this.#unknown;
    }

    // The null token's zero decimals would turn e8s into a number that is wrong rather than
    // obviously missing, and every consumer of this class formats through here, so one guard
    // covers message content, gates and the wallet alike.
    formatTokens(amount: bigint) {
        if (this.#unknown) return "?????";
        return formatTokens(amount, this.#decimals);
    }

    getConvertedTokens(amount: bigint) {
        return getConvertedTokenValue(
            this.#selectedConversion,
            getConvertedBalances(rates(), amount, this.#decimals, this.#ledger),
        );
    }

    formatConvertedTokens(amount: bigint) {
        return formatConvertedValue(this.#selectedConversion, this.getConvertedTokens(amount));
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

    // The fee the ledger charges for a single transfer
    get transferFee() {
        return this.#transferFee;
    }

    get transferFees(): bigint {
        return this.#transferFees;
    }

    // Undefined goes back to a single transfer's fee
    set transferFees(val: bigint | undefined) {
        this.#fees = val;
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
        this.#unknown = false;
    }

    get refreshingBalance() {
        return this.#refreshingBalance;
    }

    set selectedConversion(val: ConversionToken) {
        this.#selectedConversion = val;
    }

    refreshBalance(client: OpenChat) {
        // The null token's ledger is "", and refreshing that reaches the worker as
        // Principal.fromText("") - one unhandled rejection per tap. Nothing to refresh anyway.
        if (this.#unknown) return Promise.resolve();
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
