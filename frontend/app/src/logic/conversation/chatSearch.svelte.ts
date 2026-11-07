import type { MessageMatch } from "@client";

// Search in a chat (the conversation header's search): the chat's messages matching what was
// typed, newest first, and the one being shown. Every tree's search header uses it (the old
// trees' CurrentChatSearchHeader, src/native's conversation); the view says how a match is shown
// (`onGoTo`), and draws the field, the count and the arrows.

/** Matches scoring under this share of the best one are dropped, as weak. */
const KEEP_SHARE = 0.2;
/** How long typing pauses before it searches (ms). */
export const SEARCH_DEBOUNCE_MS = 300;
/** Mentions aside, a term this short isn't searched. */
const MIN_TERM = 3;

/**
 * The matches worth showing, newest first: those scoring at least a fifth of the best one
 * (`searchChat` gives them best first).
 */
export function rankedMatches(matches: MessageMatch[]): MessageMatch[] {
    if (matches.length === 0) return matches;
    const keep = matches[0].score * KEEP_SHARE;
    return matches.filter((m) => m.score >= keep).sort((a, b) => b.messageIndex - a.messageIndex);
}

/**
 * What's typed split into the words searched for and the users or groups it @mentions: an
 * "@name" that names someone (`lookup` gives their id) is taken out of the words and searched for
 * as a sender. Only in a group or channel; in a DM it's all words.
 */
export function searchTerms(
    text: string,
    group: boolean,
    lookup: (name: string) => string | undefined,
): { term: string; mentions: string[] } {
    if (!group) return { term: text, mentions: [] };
    const mentioned = new Set<string>();
    const term = text.replace(/@(\w*)/g, (match, name: string) => {
        const id = lookup(name);
        if (id === undefined) return match;
        mentioned.add(id);
        return "";
    });
    return { term, mentions: [...mentioned] };
}

export type ChatSearchOptions = {
    /** The chat's messages matching the words (lower case) or from those mentioned; none if it failed. */
    search: (term: string, mentions: string[]) => Promise<MessageMatch[] | undefined>;
    /** A group or channel, where "@name" searches for a sender. */
    group: boolean;
    /** The id of the user or group an "@name" names. */
    lookup: (name: string) => string | undefined;
    /** Shows a match (its message index, kept marked), or -1: none any more. */
    onGoTo: (messageIndex: number) => void;
};

export class ChatSearch {
    #matches = $state<MessageMatch[]>([]);
    #current = $state(0);
    #searching = $state(false);
    // what was last searched for: typing the same again doesn't search again
    #searched = "";
    #timer: ReturnType<typeof setTimeout> | undefined;
    #options: ChatSearchOptions;

    constructor(options: ChatSearchOptions) {
        this.#options = options;
    }

    get matches(): MessageMatch[] {
        return this.#matches;
    }

    /** The match shown, as its position in `matches` (0 the newest). */
    get current(): number {
        return this.#current;
    }

    get searching(): boolean {
        return this.#searching;
    }

    /** Whether `text` is what was last searched for. */
    searched(text: string): boolean {
        return this.#searched === text;
    }

    /** What's typed, searched once typing pauses (SEARCH_DEBOUNCE_MS). */
    typed(text: string): void {
        // (a search waiting for a pause is for older text: typing back to the last search drops it)
        clearTimeout(this.#timer);
        if (this.#searched === text) return;
        this.#timer = setTimeout(() => void this.search(text), SEARCH_DEBOUNCE_MS);
    }

    /** Searches for `text` now (Enter, a mention picked), unless it was the last search. */
    async search(text: string): Promise<void> {
        clearTimeout(this.#timer);
        if (this.#searched === text) return;
        this.#clear();
        // (the old headers kept the last search's text over a term too short to search, so typing
        // that search again after it found nothing)
        this.#searched = text;
        const { term, mentions } = searchTerms(text, this.#options.group, this.#options.lookup);
        if (term.length < MIN_TERM && mentions.length === 0) return;
        this.#searching = true;
        try {
            const found = await this.#options.search(term.toLowerCase(), mentions);
            // a later search has started since: its results are the ones to show
            if (this.#searched !== text || found === undefined) return;
            this.#matches = rankedMatches(found);
            if (this.#matches.length > 0) this.#show(0);
        } catch {
            // a failed search shows no matches
        } finally {
            if (this.#searched === text) this.#searching = false;
        }
    }

    /** Whether there's an older match than the one shown, or a newer one. */
    get hasOlder(): boolean {
        return this.#current < this.#matches.length - 1;
    }

    get hasNewer(): boolean {
        return this.#matches.length > 0 && this.#current > 0;
    }

    /** Shows the next older match; past the oldest, `wrap` goes round to the newest. */
    older(wrap: boolean): void {
        this.#step(1, wrap);
    }

    /** Shows the next newer match; past the newest, `wrap` goes round to the oldest. */
    newer(wrap: boolean): void {
        this.#step(-1, wrap);
    }

    /**
     * Ends the search: no matches shown, nothing waiting, and a search still under way dropped.
     * The same text searched again later (the search reopened) is searched afresh.
     */
    dispose(): void {
        clearTimeout(this.#timer);
        this.#searched = "";
        this.#clear();
    }

    #step(by: number, wrap: boolean) {
        const n = this.#matches.length;
        if (n === 0) return;
        const next = this.#current + by;
        if (next >= 0 && next < n) this.#show(next);
        else if (wrap) this.#show((next + n) % n);
    }

    #show(at: number) {
        this.#current = at;
        this.#options.onGoTo(this.#matches[at].messageIndex);
    }

    #clear() {
        this.#matches = [];
        this.#current = 0;
        this.#searching = false;
        this.#options.onGoTo(-1);
    }
}
