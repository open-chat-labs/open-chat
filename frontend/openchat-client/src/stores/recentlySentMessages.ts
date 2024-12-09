import { createMapStore } from "./mapStore";
import { writable } from "svelte/store";

// Key: MessageId, Value: Timestamp
export const recentlySentMessagesStore = createMapStore<bigint, bigint>(
    writable(new Map<bigint, bigint>()),
);

function pruneOldMessages(): void {
    if (recentlySentMessagesStore.size() > 0) {
        const oneMinuteAgo = BigInt(Date.now() - 60000);
        recentlySentMessagesStore.update((map) => {
            const newMap = new Map<bigint, bigint>();
            for (const [key, value] of map.entries()) {
                if (value > oneMinuteAgo) {
                    newMap.set(key, value);
                }
            }
            return newMap;
        });
    }
}

// Prune old messages every 31 seconds
window.setInterval(pruneOldMessages, 31000);
