import type { KlipyObject, KlipySearchResponse } from "@client";
import {
    gifsNotFound,
    klipySuggestionsUrl,
    klipyUrl,
    nextPosition,
    type GifsNotFound,
} from "./gifs";

const PAGE = 24;
const SUGGESTIONS = 8;
// how many pages of GIFs already shown are skipped for one with a new one, before waiting for the
// next scroll
const REPEATS_SKIPPED = 3;

/**
 * The GIFs a picker shows (logic/composer/gifs): the trending ones, or those matching what's typed,
 * a page at a time as the list is scrolled, without repeats. A search typed while a page is on its
 * way replaces it. A search that finds none says so (`notFound`) with related terms to search for,
 * or, with none to be had, the trending GIFs under it.
 */
export class GifFeed {
    #gifs = $state.raw<KlipyObject[]>([]);
    #loading = $state(false);
    #failed = $state(false);
    #query = "";
    #pos = "";
    #exhausted = false;
    #run = 0;
    #notFound = $state.raw<GifsNotFound | undefined>();

    constructor(
        private readonly apiKey: string,
        private readonly fetchPage: (url: string) => Promise<KlipySearchResponse> = async (url) =>
            (await fetch(url)).json(),
        private readonly fetchTerms: (url: string) => Promise<{ results?: string[] }> = async (
            url,
        ) => (await fetch(url)).json(),
    ) {}

    /** The last search found no GIFs: what's shown instead. */
    get notFound(): GifsNotFound | undefined {
        return this.#notFound;
    }

    get gifs(): KlipyObject[] {
        return this.#gifs;
    }

    /** A page is on its way. */
    get loading(): boolean {
        return this.#loading;
    }

    /** The last page couldn't be loaded. */
    get failed(): boolean {
        return this.#failed;
    }

    /** Starts again: the trending GIFs for nothing typed, else those matching it. */
    search(query: string): Promise<void> {
        this.#run += 1;
        this.#query = query.trim();
        this.#pos = "";
        this.#exhausted = false;
        this.#gifs = [];
        this.#loading = false;
        this.#notFound = undefined;
        return this.more();
    }

    /**
     * The next page, unless there are no more or one is on its way. A page of GIFs already shown
     * adds nothing for the list to grow by, so the page after it is fetched (a few at most).
     */
    async more(): Promise<void> {
        if (this.#loading || this.#exhausted) return;
        const run = this.#run;
        this.#loading = true;
        this.#failed = false;
        try {
            for (let skipped = 0; ; skipped++) {
                const url = klipyUrl(this.apiKey, this.#query, this.#pos, PAGE);
                const page = await this.fetchPage(url);
                if (run !== this.#run) return;
                const next = nextPosition(page);
                this.#pos = next ?? "";
                this.#exhausted = next === undefined;
                const seen = new Set(this.#gifs.map((g) => g.id));
                const fresh = (page.results ?? []).filter((g) => !seen.has(g.id));
                this.#gifs = [...this.#gifs, ...fresh];
                if (fresh.length > 0 || this.#exhausted || skipped >= REPEATS_SKIPPED) break;
            }
            if (this.#gifs.length === 0 && this.#query !== "" && this.#exhausted) {
                await this.#nothingFound(this.#query, run);
            }
        } catch (err) {
            if (run !== this.#run) return;
            console.warn("Couldn't load GIFs", err);
            this.#failed = true;
        } finally {
            if (run === this.#run) this.#loading = false;
        }
    }

    // a search that found none: related terms, or the trending GIFs
    async #nothingFound(query: string, run: number): Promise<void> {
        let terms: string[] | undefined;
        try {
            terms = (await this.fetchTerms(klipySuggestionsUrl(this.apiKey, query, SUGGESTIONS)))
                .results;
        } catch (err) {
            console.warn("Couldn't load GIF search suggestions", err);
        }
        if (run !== this.#run) return;
        const shown = gifsNotFound(query, terms);
        this.#notFound = shown;
        if (shown.kind === "trending") {
            this.#query = "";
            this.#pos = "";
            this.#exhausted = false;
            this.#loading = false;
            await this.more();
        }
    }
}
