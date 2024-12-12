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

function createSearchState<T>() {
    const state: Search<T> = $state({
        scrollPos: 0,
        term: "",
        results: [],
        total: 0,
        index: 0,
    });

    return new SearchState<T>(state);
}

class SearchState<T> {
    constructor(private state: Search<T>) {}

    public reset() {
        this.state.index = 0;
    }

    public nextPage() {
        this.state.index += 1;
    }

    public appendResults(results: T[]) {
        this.state.results = [...this.state.results, ...results];
    }

    public get term(): string {
        return this.state.term;
    }

    public set term(val: string) {
        this.state.term = val;
    }

    public get scrollPos(): number {
        return this.state.scrollPos;
    }

    public set scrollPos(val: number) {
        this.state.scrollPos = val;
    }

    public get results(): T[] {
        return this.state.results;
    }

    public set results(val: T[]) {
        this.state.results = val;
    }

    public get total(): number {
        return this.state.total;
    }

    public set total(val: number) {
        this.state.total = val;
    }

    public get index(): number {
        return this.state.index;
    }

    public set index(val: number) {
        this.state.index = val;
    }
}

export const communitySearchState = createSearchState<CommunityMatch>();
export const botSearchState = createSearchState<BotMatch>();
