import { derived, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import {
    type CryptocurrencyDetails,
    type EnhancedTokenDetails,
    type NervousSystemDetails,
    DEFAULT_TOKENS,
    type TokenExchangeRates,
} from "openchat-shared";
import { toRecord } from "../utils/list";

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
        const xrBTCtoDollar = $exchangeRatesLookup["btc"]?.toUSD;
        const xrETHtoDollar = $exchangeRatesLookup["eth"]?.toUSD;

        const xrDollarToBTC = xrBTCtoDollar === undefined ? 0 : 1 / xrBTCtoDollar;
        const xrDollarToETH = xrETHtoDollar === undefined ? 0 : 1 / xrETHtoDollar;

        const accounts: EnhancedTokenDetails[] = Object.values($lookup).map((t) => {
            const balance = $balance[t.ledger] ?? BigInt(0);
            const symbolLower = t.symbol.toLowerCase();
            const balanceWholeUnits = Number(balance) / Math.pow(10, t.decimals);
            const rates = $exchangeRatesLookup[symbolLower];
            const xrUSD = rates?.toUSD;
            const dollarBalance = xrUSD !== undefined ? xrUSD * balanceWholeUnits : undefined;
            const xrICP = rates?.toICP;
            const icpBalance = xrICP !== undefined ? xrICP * balanceWholeUnits : undefined;
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

export const cryptoTokensSorted = derived([enhancedCryptoLookup], ([$lookup]) => {
    return Object.values($lookup)
        .filter((t) => t.enabled || !t.zero)
        .sort((a, b) => {
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
        });
});
