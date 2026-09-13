import type { BotMatch, CommunityMatch, GroupMatch } from "@client";
import { type Subscriber, writable } from "svelte/store";

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
        subscribe: (subscriber: Subscriber<Search<T>>, invalidate?: () => void) =>
            store.subscribe(subscriber, invalidate),
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

function createSearchState<T>(keyOf: KeyOf<T>) {
    const state: Search<T> = $state({
        scrollPos: 0,
        term: "",
        results: [],
        total: 0,
        index: 0,
    });

    return new SearchState<T>(state, keyOf);
}

// Method-style so the parameter is bivariant: with a plain function-typed field
// `SearchState<CommunityMatch> | SearchState<BotMatch>` no longer widens to
// `SearchState<CommunityMatch | BotMatch>`, which Explore relies on.
type KeyOf<T> = { keyOf(item: T): string }["keyOf"];

export class SearchState<T> {
    constructor(
        private state: Search<T>,
        private keyOf: KeyOf<T>,
    ) {}

    public reset() {
        this.state.index = 0;
    }

    public nextPage() {
        this.state.index += 1;
    }

    // Pages are served against a ranking that can shift between requests, so a later page can
    // repeat an item from an earlier one. The keyed {#each} rendering the list throws on a
    // repeated key (svelte's each_key_duplicate), taking the whole page down with it.
    public appendResults(results: T[]) {
        const seen = new Set(this.state.results.map(this.keyOf));
        const fresh: T[] = [];
        for (const item of results) {
            const key = this.keyOf(item);
            if (seen.has(key)) continue;
            seen.add(key);
            fresh.push(item);
        }
        this.state.results = [...this.state.results, ...fresh];
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

export const communitySearchState = createSearchState<CommunityMatch>((c) => c.id.communityId);
export const groupSearchState = createSearchState<GroupMatch>((g) => g.chatId.groupId);
export const botSearchState = createSearchState<BotMatch>((b) => b.id);
