import { derived, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import {
    dollarExchangeRates,
    type CryptocurrencyDetails,
    type NervousSystemDetails,
    DEFAULT_TOKENS,
} from "openchat-shared";
import { toRecord } from "../utils/list";

type LedgerCanister = string;
type GovernanceCanister = string;

type BalanceByCrypto = Record<LedgerCanister, bigint>;

export const cryptoLookup = writable<Record<LedgerCanister, CryptocurrencyDetails>>({});
export const nervousSystemLookup = writable<Record<GovernanceCanister, NervousSystemDetails>>({});
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
    [cryptoLookup, cryptoBalance],
    ([$lookup, $balance]) => {
        const accounts = Object.values($lookup).map((t) => {
            const balance = $balance[t.ledger] ?? BigInt(0);
            const xr = dollarExchangeRates[t.symbol.toLowerCase()];
            const balanceWholeUnits = Number(balance) / Math.pow(10, t.decimals);
            const dollarBalance = xr > 0 ? balanceWholeUnits / xr : 0;
            const zero = balance === BigInt(0) && !DEFAULT_TOKENS.includes(t.symbol);
            return {
                ...t,
                balance,
                dollarBalance,
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
