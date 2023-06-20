import type { Cryptocurrency, Tokens } from "openchat-shared";
import { writable } from "svelte/store";
import { configKeys } from "../utils/config";

type BalanceByCrypto = Record<Cryptocurrency, bigint>;

const cryptoBalanceStore = writable<BalanceByCrypto>({
    icp: BigInt(0),
    sns1: BigInt(0),
    ckbtc: BigInt(0),
    chat: BigInt(0),
    kinic: BigInt(0),
});

export const cryptoBalance = {
    subscribe: cryptoBalanceStore.subscribe,
    set: (crypto: Cryptocurrency, balance: Tokens): void => {
        cryptoBalanceStore.update((record) => {
            return {
                ...record,
                [crypto]: balance.e8s,
            };
        });
    },
};

const lastCryptoSentStore = writable<Cryptocurrency>(
    (localStorage.getItem(configKeys.lastCryptoSent) || "icp") as Cryptocurrency
);

export const lastCryptoSent = {
    subscribe: lastCryptoSentStore.subscribe,
    set: (token: Cryptocurrency): void => {
        lastCryptoSentStore.set(token);
        localStorage.setItem(configKeys.lastCryptoSent, token);
    },
};
