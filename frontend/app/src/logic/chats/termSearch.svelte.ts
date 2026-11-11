// Looking something up on OpenChat as the user types (the native Chats search's People and New chat
// look people up, the web chat list people, bots and groups): once the text has stopped changing
// for a moment, only the latest search's answer is kept, and an emptied text drops it.

export const TERM_SEARCH_DEBOUNCE_MS = 300;

/** What a search shows: nothing asked, an answer on its way, or what was found for `term`. */
export type TermResults<T> =
    | { kind: "idle" }
    | { kind: "searching"; term: string }
    | { kind: "found"; term: string; found: T };

/**
 * How a term is looked up (client.searchUsers, client.searchChatList), which never rejects: a
 * failure finds nothing.
 */
export type SearchTerm<T> = (term: string) => Promise<T>;

export class TermSearch<T> {
    #search: SearchTerm<T>;
    #delay: number;
    #timer: ReturnType<typeof setTimeout> | undefined;
    // the latest search: an older one's answer is dropped
    #asked = 0;

    results = $state<TermResults<T>>({ kind: "idle" });

    constructor(search: SearchTerm<T>, delay: number = TERM_SEARCH_DEBOUNCE_MS) {
        this.#search = search;
        this.#delay = delay;
    }

    /** The search term changed (a `searchTerm`): looks it up once it stops changing. */
    set(term: string): void {
        const current = this.results;
        // the same text again (a space added at the end) keeps the search it has
        if (current.kind === "idle" ? term === "" : current.term === term) return;
        clearTimeout(this.#timer);
        const asked = ++this.#asked;
        if (term === "") {
            this.results = { kind: "idle" };
            return;
        }
        this.results = { kind: "searching", term };
        this.#timer = setTimeout(() => void this.#run(term, asked), this.#delay);
    }

    /** Stops a pending search (the screen is going away). */
    dispose(): void {
        clearTimeout(this.#timer);
        this.#asked++;
    }

    async #run(term: string, asked: number): Promise<void> {
        const found = await this.#search(term);
        if (asked === this.#asked) this.results = { kind: "found", term, found };
    }
}
