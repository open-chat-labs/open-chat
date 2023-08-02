import type { Tokens } from "openchat-shared";
import { writable } from "svelte/store";
import { configKeys } from "../utils/config";
import {
    CHAT_SYMBOL,
    CKBTC_SYMBOL,
    cryptoLookup,
    GHOST_SYMBOL,
    HOTORNOT_SYMBOL,
    ICP_SYMBOL,
    KINIC_SYMBOL,
    SNS1_SYMBOL,
} from "openchat-shared";

type BalanceByCrypto = Record<string, bigint>;

const cryptoBalanceStore = writable<BalanceByCrypto>({
    [ICP_SYMBOL]: BigInt(0),
    [SNS1_SYMBOL]: BigInt(0),
    [CKBTC_SYMBOL]: BigInt(0),
    [CHAT_SYMBOL]: BigInt(0),
    [KINIC_SYMBOL]: BigInt(0),
    [HOTORNOT_SYMBOL]: BigInt(0),
    [GHOST_SYMBOL]: BigInt(0),
});

export const cryptoBalance = {
    subscribe: cryptoBalanceStore.subscribe,
    set: (crypto: string, balance: Tokens): void => {
        cryptoBalanceStore.update((record) => {
            record[crypto] = balance.e8s;
            return record;
        });
    },
};

const lastCryptoSentStore = writable<string>(getLastCryptoSent());

function getLastCryptoSent(): string {
    const token = localStorage.getItem(configKeys.lastCryptoSent) || ICP_SYMBOL;
    return cryptoLookup[token] !== undefined ? token : ICP_SYMBOL;
}

export const lastCryptoSent = {
    subscribe: lastCryptoSentStore.subscribe,
    set: (token: string): void => {
        lastCryptoSentStore.set(token);
        localStorage.setItem(configKeys.lastCryptoSent, token);
    },
};
