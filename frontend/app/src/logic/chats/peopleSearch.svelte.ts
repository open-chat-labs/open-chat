import type { UserSummary } from "@client";

// Looking people up on OpenChat as the user types (the Chats search's People, New chat): once the
// text has stopped changing for a moment, only the latest search's answer is kept, and an emptied
// text drops it.

export const PEOPLE_SEARCH_DEBOUNCE_MS = 300;

/** What a search shows: nothing asked, an answer on its way, or the people found for `term`. */
export type PeopleResults =
    | { kind: "idle" }
    | { kind: "searching"; term: string }
    | { kind: "found"; term: string; people: UserSummary[] };

/** How people are looked up (client.searchUsers, which never rejects: a failure finds nobody). */
export type SearchUsers = (term: string) => Promise<UserSummary[]>;

export class PeopleSearch {
    #search: SearchUsers;
    #delay: number;
    #timer: ReturnType<typeof setTimeout> | undefined;
    // the latest search: an older one's answer is dropped
    #asked = 0;

    results = $state<PeopleResults>({ kind: "idle" });

    constructor(search: SearchUsers, delay: number = PEOPLE_SEARCH_DEBOUNCE_MS) {
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
        const people = await this.#search(term);
        if (asked === this.#asked) this.results = { kind: "found", term, people };
    }
}
