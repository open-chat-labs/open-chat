import type { KlipyObject, KlipySearchResponse } from "@client";
import { klipyUrl, nextPosition } from "./gifs";

const PAGE = 24;

/**
 * The GIFs a picker shows (logic/composer/gifs): the trending ones, or those matching what's typed,
 * a page at a time as the list is scrolled, without repeats. A search typed while a page is on its
 * way replaces it.
 */
export class GifFeed {
    #gifs = $state.raw<KlipyObject[]>([]);
    #loading = $state(false);
    #failed = $state(false);
    #query = "";
    #pos = "";
    #exhausted = false;
    #run = 0;

    constructor(
        private readonly apiKey: string,
        private readonly fetchPage: (url: string) => Promise<KlipySearchResponse> = async (url) =>
            (await fetch(url)).json(),
    ) {}

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
        return this.more();
    }

    /** The next page, unless there are no more or one is on its way. */
    async more(): Promise<void> {
        if (this.#loading || this.#exhausted) return;
        const run = this.#run;
        this.#loading = true;
        this.#failed = false;
        try {
            const page = await this.fetchPage(klipyUrl(this.apiKey, this.#query, this.#pos, PAGE));
            if (run !== this.#run) return;
            const next = nextPosition(page);
            this.#pos = next ?? "";
            this.#exhausted = next === undefined;
            const seen = new Set(this.#gifs.map((g) => g.id));
            this.#gifs = [...this.#gifs, ...(page.results ?? []).filter((g) => !seen.has(g.id))];
        } catch (err) {
            if (run !== this.#run) return;
            console.warn("Couldn't load GIFs", err);
            this.#failed = true;
        } finally {
            if (run === this.#run) this.#loading = false;
        }
    }
}
