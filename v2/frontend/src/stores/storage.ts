import { derived, writable } from "svelte/store";

type StorageStats = {
    byteLimit: number;
    bytesUsed: number;
};

export const storageStore = writable<StorageStats>({
    byteLimit: 0,
    bytesUsed: 0,
});

export const remainingStorage = derived(
    [storageStore],
    ([$storageStore]) => $storageStore.byteLimit - $storageStore.bytesUsed
);
