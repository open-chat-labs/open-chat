import { derived, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import {
    type CryptocurrencyDetails,
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

        const accounts = Object.values($lookup).map((t) => {
            const balance = $balance[t.ledger] ?? BigInt(0);
            const symbolLower = t.symbol.toLowerCase();
            const balanceWholeUnits = Number(balance) / Math.pow(10, t.decimals);
            const rates = $exchangeRatesLookup[symbolLower];
            const xrUSD = rates?.toUSD ?? 0;
            const dollarBalance = xrUSD * balanceWholeUnits;
            const xrICP = rates?.toICP ?? 0;
            const icpBalance = xrICP * balanceWholeUnits;
            const btcBalance = dollarBalance * xrDollarToBTC;
            const ethBalance = dollarBalance * xrDollarToETH;
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
    return Object.values($lookup).sort((a, b) => {
        // Sort by $ balance
        // Then by whether token is a default
        // Then by default precedence
        // Then alphabetically by symbol
        if (a.dollarBalance < b.dollarBalance) {
            return 1;
        } else if (a.dollarBalance > b.dollarBalance) {
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
