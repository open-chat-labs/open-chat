import { derived, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import {
    type CryptocurrencyDetails,
    type EnhancedTokenDetails,
    type NervousSystemDetails,
    DEFAULT_TOKENS,
    type TokenExchangeRates,
    type WalletConfig,
} from "openchat-shared";
import { toRecord } from "../utils/list";
import { localGlobalUpdates } from "./localGlobalUpdates";

type LedgerCanister = string;
type GovernanceCanister = string;

type BalanceByCrypto = Record<LedgerCanister, bigint>;

export const cryptoLookup = writable<Record<LedgerCanister, CryptocurrencyDetails>>({});
export const nervousSystemLookup = writable<Record<GovernanceCanister, NervousSystemDetails>>({});
export const exchangeRatesLookupStore = writable<Record<string, TokenExchangeRates>>({});

const cryptoBalanceStore = writable<BalanceByCrypto>({});

export const cryptoBalance = {
    subscribe: cryptoBalanceStore.subscribe,
    set: (ledger: string, balance: bigint): void => {
        cryptoBalanceStore.update((record) => {
            record[ledger] = balance;
            return record;
        });
    },
};

const lastCryptoSentStore = writable<string | undefined>(
    localStorage.getItem(configKeys.lastCryptoSent) ?? undefined,
);

export const lastCryptoSent = {
    subscribe: lastCryptoSentStore.subscribe,
    set: (ledger: string): void => {
        lastCryptoSentStore.set(ledger);
        localStorage.setItem(configKeys.lastCryptoSent, ledger);
    },
};

export const enhancedCryptoLookup = derived(
    [cryptoLookup, cryptoBalance, exchangeRatesLookupStore],
    ([$lookup, $balance, $exchangeRatesLookup]) => {
        const xrICPtoDollar = $exchangeRatesLookup["icp"]?.toUSD;
        const xrBTCtoDollar = $exchangeRatesLookup["btc"]?.toUSD;
        const xrETHtoDollar = $exchangeRatesLookup["eth"]?.toUSD;

        const xrDollarToICP = xrICPtoDollar === undefined ? 0 : 1 / xrICPtoDollar;
        const xrDollarToBTC = xrBTCtoDollar === undefined ? 0 : 1 / xrBTCtoDollar;
        const xrDollarToETH = xrETHtoDollar === undefined ? 0 : 1 / xrETHtoDollar;

        const accounts: EnhancedTokenDetails[] = Object.values($lookup).map((t) => {
            const balance = $balance[t.ledger] ?? BigInt(0);
            const symbolLower = t.symbol.toLowerCase();
            const balanceWholeUnits = Number(balance) / Math.pow(10, t.decimals);
            const rates = $exchangeRatesLookup[symbolLower];
            const xrUSD = rates?.toUSD;
            const dollarBalance = xrUSD !== undefined ? xrUSD * balanceWholeUnits : undefined;
            const icpBalance =
                dollarBalance !== undefined && xrDollarToICP !== undefined
                    ? dollarBalance * xrDollarToICP
                    : undefined;
            const btcBalance =
                dollarBalance !== undefined && xrDollarToBTC !== undefined
                    ? dollarBalance * xrDollarToBTC
                    : undefined;
            const ethBalance =
                dollarBalance !== undefined && xrDollarToETH !== undefined
                    ? dollarBalance * xrDollarToETH
                    : undefined;
            const zero = balance === BigInt(0) && !DEFAULT_TOKENS.includes(t.symbol);
            return {
                ...t,
                balance,
                dollarBalance,
                icpBalance,
                btcBalance,
                ethBalance,
                zero,
                urlFormat: t.transactionUrlFormat,
            };
        });

        return toRecord(accounts, (a) => a.ledger);
    },
);

export const serverWalletConfigStore = writable<WalletConfig>({
    kind: "auto_wallet",
    minDollarValue: 0,
});

export const walletConfigStore = derived(
    [serverWalletConfigStore, localGlobalUpdates],
    ([$serverWalletConfig, $localGlobalUpdates]) => {
        return $localGlobalUpdates.get("global")?.walletConfig ?? $serverWalletConfig;
    },
);

export const cryptoTokensSorted = derived([enhancedCryptoLookup], ([$lookup]) => {
    return Object.values($lookup)
        .filter((t) => t.enabled || !t.zero)
        .sort(compareTokens);
});

function meetsAutoWalletCriteria(config: WalletConfig, token: EnhancedTokenDetails): boolean {
    return (
        config.kind === "auto_wallet" &&
        (DEFAULT_TOKENS.includes(token.symbol) ||
            (config.minDollarValue <= 0 && token.balance > 0) ||
            (config.minDollarValue > 0 && (token.dollarBalance ?? 0) >= config.minDollarValue))
    );
}

function meetsManualWalletCriteria(config: WalletConfig, token: EnhancedTokenDetails): boolean {
    return config.kind === "manual_wallet" && config.tokens.has(token.ledger);
}

export const walletTokensSorted = derived(
    [cryptoTokensSorted, walletConfigStore],
    ([$tokens, $walletConfig]) => {
        return $tokens.filter(
            (t) =>
                meetsAutoWalletCriteria($walletConfig, t) ||
                meetsManualWalletCriteria($walletConfig, t),
        );
    },
);

function compareTokens(a: EnhancedTokenDetails, b: EnhancedTokenDetails): number {
    // Sort by non-zero balances first
    // Then by $ balance
    // Then by whether token is a default
    // Then by default precedence
    // Then alphabetically by symbol

    const aNonZero = a.balance > 0;
    const bNonZero = b.balance > 0;

    if (aNonZero !== bNonZero) {
        return aNonZero ? -1 : 1;
    }

    const aDollarBalance = a.dollarBalance ?? -1;
    const bDollarBalance = b.dollarBalance ?? -1;

    if (aDollarBalance < bDollarBalance) {
        return 1;
    } else if (aDollarBalance > bDollarBalance) {
        return -1;
    } else {
        const defA = DEFAULT_TOKENS.indexOf(a.symbol);
        const defB = DEFAULT_TOKENS.indexOf(b.symbol);

        if (defA >= 0 && defB >= 0) {
            return defA < defB ? 1 : -1;
        } else if (defA >= 0) {
            return 1;
        } else if (defB >= 0) {
            return -1;
        } else {
            return a.symbol.localeCompare(b.symbol);
        }
    }
}
