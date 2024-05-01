import { writable } from "svelte/store";

type Promisey = {
    resolve: (pin: string) => void;
    reject: (err: unknown) => void;
};

const pinStore = writable<Promisey | undefined>(undefined);

export function getPin(): Promise<string> {
    return new Promise((resolve, reject) => {
        pinStore.set({
            resolve: (pin) => {
                pinStore.set(undefined);
                resolve(pin);
            },
            reject: (err) => {
                pinStore.set(undefined);
                reject(err);
            },
        });
    });
}
