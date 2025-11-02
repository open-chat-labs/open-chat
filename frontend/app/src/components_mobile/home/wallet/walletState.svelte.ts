import { formatTokens, type EnhancedTokenDetails } from "openchat-client";

export type ConversionToken = "usd" | "icp" | "btc" | "eth";

export function getConvertedTokenValue(
    c: ConversionToken,
    t: EnhancedTokenDetails,
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

export function formatTokenValue(c: ConversionToken, val?: number): string {
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
    return formatTokenValue(c, getConvertedTokenValue(c, t));
}

export class TokenState {
    #selectedConversion = $state<ConversionToken>();
    #token = $state<EnhancedTokenDetails>();
    #tokenBalance = $derived.by(() => {
        const n = Number(this.token.balance);
        return n / Math.pow(10, this.token.decimals);
    });
    #formattedTokenBalance = $derived(formatTokens(this.token.balance, this.token.decimals));
    #convertedValue = $derived(getConvertedTokenValue(this.selectedConversion, this.token));
    #formattedConvertedValue = $derived(
        formatTokenValue(this.selectedConversion, this.#convertedValue),
    );
    #formattedUnitValue = $derived.by(() => {
        if (this.#convertedValue === undefined) return "?????";
        return formatTokenValue(
            this.selectedConversion,
            this.#convertedValue / Number(this.#tokenBalance),
        );
    });

    constructor(t: EnhancedTokenDetails, c: ConversionToken) {
        this.token = t;
        this.selectedConversion = c;
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
        if (this.#token === undefined) {
            throw new Error("Trying to access token before it has been initialised");
        }
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

    set selectedConversion(val: ConversionToken) {
        this.#selectedConversion = val;
    }
}
