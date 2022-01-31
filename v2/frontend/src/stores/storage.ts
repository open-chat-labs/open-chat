import type { StorageStatus } from "../domain/data/data";
import { derived, writable } from "svelte/store";

export const ONE_MB = 1024 * 1024;
export const ONE_HUNDRED_MB = ONE_MB * 100;
export const ONE_GB = ONE_MB * 1000;

export const storageStore = writable<StorageStatus>({
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
        mbLimit: Math.ceil($storageStore.byteLimit / ONE_MB),
        mbUsed: Math.ceil($storageStore.bytesUsed / ONE_MB),
    };
});
