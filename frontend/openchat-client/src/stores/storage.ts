import type { StorageStatus } from "openchat-shared";
import { derived, writable } from "svelte/store";

export const ONE_MB = 1024 * 1024;
export const ONE_GB = ONE_MB * 1024;

export const storageStore = writable<StorageStatus>({
    byteLimit: 0,
    bytesUsed: 0,
});

export function updateStorageLimit(limit: number): void {
    storageStore.update((store) => {
        return {
            bytesUsed: store.bytesUsed,
            byteLimit: limit,
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

export const storageInGb = derived([storageStore], ([$storageStore]) => {
    return {
        gbLimit: $storageStore.byteLimit / ONE_GB,
        gbUsed: $storageStore.bytesUsed / ONE_GB,
    };
});
