import type { BotMatch, CommunityMatch } from "openchat-client";
import { writable } from "svelte/store";

type Search<T> = {
    scrollPos: number;
    term: string;
    results: T[];
    total: number;
    index: number;
};

function createSearchStore<T>() {
    const store = writable<Search<T>>({
        scrollPos: 0,
        term: "",
        results: [],
        total: 0,
        index: 0,
    });
    return {
        subscribe: store.subscribe,
        setSearchTerm: (term: string) => store.update((val) => ({ ...val, term })),
        setScrollPos: (scrollPos: number) => store.update((val) => ({ ...val, scrollPos })),
        reset: () => store.update((val) => ({ ...val, index: 0 })),
        nextPage: () => store.update((val) => ({ ...val, index: val.index + 1 })),
        setResults: (results: T[]) => store.update((val) => ({ ...val, results })),
        setTotal: (total: number) => store.update((val) => ({ ...val, total })),
        appendResults: (results: T[]) =>
            store.update((val) => ({ ...val, results: [...val.results, ...results] })),
    };
}

export const communitySearchStore = createSearchStore<CommunityMatch>();

export const botSearchStore = createSearchStore<BotMatch>();
