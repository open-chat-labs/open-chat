import type { CommunityMatch } from "openchat-client";
import { writable } from "svelte/store";

type CommunitySearch = {
    results: CommunityMatch[];
    total: number;
    index: number;
};

const store = writable<CommunitySearch>({
    results: [],
    total: 0,
    index: 0,
});

export const communitySearchStore = {
    subscribe: store.subscribe,
    reset: () => store.update((val) => ({ ...val, index: 0 })),
    nextPage: () => store.update((val) => ({ ...val, index: val.index + 1 })),
    setResults: (results: CommunityMatch[]) => store.update((val) => ({ ...val, results })),
    setTotal: (total: number) => store.update((val) => ({ ...val, total })),
    appendResults: (results: CommunityMatch[]) =>
        store.update((val) => ({ ...val, results: [...val.results, ...results] })),
};
