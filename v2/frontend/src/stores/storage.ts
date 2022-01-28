import { derived, writable } from "svelte/store";

export const ONE_HUNDRED_MB = 100_000_000;
export const ONE_GB = 1000_000_000;

type StorageStats = {
    byteLimit: number;
    bytesUsed: number;
};

// export const storageStore = writable<StorageStats>({
//     byteLimit: 0,
//     bytesUsed: 0,
// });

export const storageStore = writable<StorageStats>({
    byteLimit: 100_000_000,
    bytesUsed: 99_999_000,
});

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
        mbLimit: Math.ceil($storageStore.bytesUsed / 1_000_000),
        mbUsed: Math.ceil($storageStore.byteLimit / 1_000_000),
    };
});
