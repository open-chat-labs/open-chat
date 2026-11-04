import type {
    BotMatch,
    CommunityMatch,
    ExploreCommunitiesResponse,
    GroupMatch,
    OpenChat,
} from "@client";
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

/** What explore's results are filtered by: the languages picked and the viewer's moderation flags. */
export type CommunitySearchFilters = { languages: string[]; flags: number };

/** The search a page of communitySearchState's results answers. */
export type CommunitySearchKey = { term: string } & CommunitySearchFilters;

export type CommunitySearch = CommunitySearchKey & {
    /** The first page (replacing the results) or the page after the last one held (added to them). */
    page: "first" | "next";
    pageSize: number;
};

/**
 * `superseded`: a later search was started before this one answered, so its answer was dropped.
 */
export type CommunitySearchOutcome = "success" | "failed" | "superseded";

// the search the held results answer, and the latest search asked for
let heldSearch: CommunitySearchKey | undefined;
let latestSearch = 0;

/** The search communitySearchState's results answer, if any has been answered yet. */
export function heldCommunitySearch(): CommunitySearchKey | undefined {
    return heldSearch;
}

/** Whether two searches ask for the same communities (the languages in any order). */
export function sameCommunitySearch(a: CommunitySearchKey, b: CommunitySearchKey): boolean {
    return (
        a.term === b.term &&
        a.flags === b.flags &&
        a.languages.length === b.languages.length &&
        a.languages.every((l) => b.languages.includes(l))
    );
}

/**
 * Explore's search step, shared by every tree: asks for the first page (replacing the results) or
 * the next one (added to them, without repeating a community already held: appendResults) and
 * sets the total. An empty term is sent as none. Only the latest search's answer is kept, and the
 * page counter only moves once a page has arrived, so a failed Load more asks for the same page
 * again. A page shorter than asked for is the last, whatever the total says (a repeat dropped
 * from it would otherwise leave Load more showing for good).
 */
export async function searchCommunities(
    client: Pick<OpenChat, "exploreCommunities">,
    search: CommunitySearch,
): Promise<CommunitySearchOutcome> {
    const id = ++latestSearch;
    const { term, languages, flags, page, pageSize } = search;
    const index = page === "first" ? 0 : communitySearchState.index + 1;
    communitySearchState.term = term;
    let response: ExploreCommunitiesResponse;
    try {
        response = await client.exploreCommunities(
            term === "" ? undefined : term,
            index,
            pageSize,
            flags,
            languages,
        );
    } catch (err) {
        console.warn("Explore communities failed", err);
        response = { kind: "offline" };
    }
    if (id !== latestSearch) return "superseded";
    if (response.kind !== "success") return "failed";
    communitySearchState.index = index;
    if (page === "first") {
        communitySearchState.results = response.matches;
    } else {
        communitySearchState.appendResults(response.matches);
    }
    communitySearchState.total =
        response.matches.length < pageSize ? communitySearchState.results.length : response.total;
    heldSearch = { term, languages: [...languages], flags };
    return "success";
}
export const groupSearchState = createSearchState<GroupMatch>((g) => g.chatId.groupId);
export const botSearchState = createSearchState<BotMatch>((b) => b.id);
