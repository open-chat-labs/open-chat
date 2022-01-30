import type { UserStorage } from "../domain/user/user";
import { derived, writable } from "svelte/store";

export const ONE_HUNDRED_MB = 100_000_000;
export const ONE_GB = 1000_000_000;

export const storageStore = writable<UserStorage>({
    byteLimit: 0,
    bytesUsed: 0,
});

export function reduceBy(bytes: number): void {
    storageStore.update((store) => {
        return {
            bytesUsed: store.bytesUsed + bytes,
            byteLimit: store.byteLimit,
        };
    });
}

export const percentageStorageUsed = derived([storageStore], ([$storageStore]) =>
    Math.ceil(($storageStore.bytesUsed / $storageStore.byteLimit) * 100)
);

export const percentageStorageRemaining = derived([storageStore], ([$storageStore]) =>
    Math.floor((1 - $storageStore.bytesUsed / $storageStore.byteLimit) * 100)
);

export const remainingStorage = derived(
    [storageStore],
    ([$storageStore]) => $storageStore.byteLimit - $storageStore.bytesUsed
);

export const storageInMb = derived([storageStore], ([$storageStore]) => {
    return {
        mbLimit: Math.ceil($storageStore.byteLimit / 1_000_000),
        mbUsed: Math.ceil($storageStore.bytesUsed / 1_000_000),
    };
});
