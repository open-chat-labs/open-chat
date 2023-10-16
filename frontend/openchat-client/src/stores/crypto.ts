import { writable } from "svelte/store";
import { configKeys } from "../utils/config";
import type { CryptocurrencyDetails, NervousSystemSummary } from "openchat-shared";

type LedgerCanister = string;

type BalanceByCrypto = Record<LedgerCanister, bigint>;

export const cryptoLookup = writable<Record<LedgerCanister, CryptocurrencyDetails>>({});
export const nervousSystemLookup = writable<Record<LedgerCanister, NervousSystemSummary>>({});
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
