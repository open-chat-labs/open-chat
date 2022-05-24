import type { Cryptocurrency, Tokens } from "../domain/crypto";
import { get, writable } from "svelte/store";

type BalanceByCrypto = Record<Cryptocurrency, bigint>;

const cryptoBalanceStore = writable<BalanceByCrypto>({
    icp: BigInt(0),
    btc: BigInt(0),
    chat: BigInt(0),
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
    (localStorage.getItem("openchat_lastcryptosent") || "icp") as Cryptocurrency
);

export const lastCryptoSent = {
    subscribe: lastCryptoSentStore.subscribe,
    set: (token: Cryptocurrency): void => {
        lastCryptoSentStore.set(token);
        localStorage.setItem("openchat_lastcryptosent", token);
    },
};
