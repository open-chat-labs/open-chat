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

function newSearch<T>(): Search<T> {
    const state: Search<T> = $state({
        scrollPos: 0,
        term: "",
        results: [],
        total: 0,
        index: 0,
    });
    return state;
}

function createSearchState<T>(keyOf: KeyOf<T>) {
    return new SearchState<T>(newSearch<T>(), keyOf);
}

// Method-style so the parameter is bivariant: with a plain function-typed field
// `SearchState<CommunityMatch> | SearchState<BotMatch>` no longer widens to
// `SearchState<CommunityMatch | BotMatch>`, which Explore relies on.
type KeyOf<T> = { keyOf(item: T): string }["keyOf"];

export class SearchState<T> {
    constructor(
        protected state: Search<T>,
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
 * `superseded`: a later search was started (or the results were set some other way) before this
 * one answered, so its answer was dropped.
 */
export type CommunitySearchOutcome = "success" | "failed" | "superseded";

/**
 * Explore's results, with the search they answer (`held`) and the latest search asked for.
 * Results set any other way (a proposal's community finder, the mobile welcome page) answer no
 * search Explore knows of, so setting them forgets `held` and drops the answer of a search still in
 * flight.
 */
export class CommunitySearchState extends SearchState<CommunityMatch> {
    #held: CommunitySearchKey | undefined;
    #latest = 0;

    public override get results(): CommunityMatch[] {
        return this.state.results;
    }

    public override set results(val: CommunityMatch[]) {
        this.#held = undefined;
        this.#latest += 1;
        this.state.results = val;
    }

    /** The search the results answer, if they answer one of searchCommunities'. */
    public get held(): CommunitySearchKey | undefined {
        return this.#held;
    }

    /** A new search starts: its id. The answer of any earlier one still in flight is dropped. */
    public start(): number {
        this.#latest += 1;
        return this.#latest;
    }

    /** Drops the answer of any search still in flight. */
    public cancel(): void {
        this.#latest += 1;
    }

    public isLatest(id: number): boolean {
        return id === this.#latest;
    }

    /**
     * A search's page arrived: the first replaces the results, a later one is added to them. A
     * page shorter than asked for is the last, whatever the total says.
     */
    public answer(
        search: CommunitySearch,
        index: number,
        matches: CommunityMatch[],
        total: number,
    ): void {
        const { term, languages, flags, page, pageSize } = search;
        this.state.index = index;
        if (page === "first") {
            this.state.results = matches;
        } else {
            this.appendResults(matches);
        }
        this.state.total = matches.length < pageSize ? this.state.results.length : total;
        this.#held = { term, languages: [...languages], flags };
    }
}

export const communitySearchState = new CommunitySearchState(
    newSearch<CommunityMatch>(),
    (c) => c.id.communityId,
);

/** The search communitySearchState's results answer, if any (see CommunitySearchState). */
export function heldCommunitySearch(): CommunitySearchKey | undefined {
    return communitySearchState.held;
}

/** Whether two lists pick the same languages, in any order and however often each is listed. */
export function sameLanguages(a: string[], b: string[]): boolean {
    const as = new Set(a);
    const bs = new Set(b);
    return as.size === bs.size && [...as].every((l) => bs.has(l));
}

/** Whether two searches ask for the same communities. */
export function sameCommunitySearch(a: CommunitySearchKey, b: CommunitySearchKey): boolean {
    return a.term === b.term && a.flags === b.flags && sameLanguages(a.languages, b.languages);
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
    const id = communitySearchState.start();
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
    if (!communitySearchState.isLatest(id)) return "superseded";
    if (response.kind !== "success") return "failed";
    communitySearchState.answer(search, index, response.matches, response.total);
    return "success";
}

export const groupSearchState = createSearchState<GroupMatch>((g) => g.chatId.groupId);
export const botSearchState = createSearchState<BotMatch>((b) => b.id);
