import { writable } from "svelte/store";
import type { Tally } from "openchat-shared";

const store = writable<Record<string, Tally>>({});

export function tallyKey(governanceCanisterId: string, proposalId: bigint): string {
    return `${governanceCanisterId}_${proposalId}`;
}

export const proposalTallies = {
    subscribe: store.subscribe,
    setTally: (governanceCanisterId: string, proposalId: bigint, tally: Tally): void => {
        store.update((state) => {
            return {
                ...state,
                [tallyKey(governanceCanisterId, proposalId)]: tally
            };
        });
    }
}
