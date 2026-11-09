import { pickedRecently, storedRecent, storeRecent } from "@src/logic/composer/recentEmoji";
import { EMOJI_CATEGORIES, type PickerEmoji } from "@src/utils/emojiCategories";
import { emojiInCategory, emojiMatching } from "@src/utils/emojis";

// The emoji a picker offers (native plan 07 "Emoji tab"): Recent, as kept on the device for the
// user, then every emoji the phone draws, by category; and those matching a search. The composer's
// emoji panel and the reaction sheet each make one as they open (EmojiGrid shows it), so both read
// and keep the same Recent.

/** How long typing pauses before the search runs. */
export const EMOJI_SEARCH_DELAY_MS = 250;

/** Where the emoji come from: the emoji data the app's pickers share (utils/emojis). */
export type EmojiSource = {
    inCategory: (group: number) => Promise<PickerEmoji[]>;
    matching: (query: string) => Promise<PickerEmoji[]>;
};

const SHARED: EmojiSource = { inCategory: emojiInCategory, matching: emojiMatching };

export class EmojiSections {
    /** Recent, newest first. */
    recent = $state.raw<string[]>([]);
    /** Each of EMOJI_CATEGORIES' emoji, in its order; undefined until it's in. */
    categories = $state.raw<(PickerEmoji[] | undefined)[]>(EMOJI_CATEGORIES.map(() => undefined));
    /** The emoji couldn't be had (they come from a CDN the first time: offline, there are none). */
    failed = $state(false);
    /** What the search found; undefined while there's no search. */
    matches = $state.raw<PickerEmoji[] | undefined>();

    readonly #userId: string;
    readonly #storage: Pick<Storage, "getItem" | "setItem"> | undefined;
    readonly #source: EmojiSource;
    #timer: ReturnType<typeof setTimeout> | undefined;
    // the search running: one started later, or the search cleared, drops what an earlier one finds
    #run = 0;

    constructor(
        userId: string,
        storage: Pick<Storage, "getItem" | "setItem"> | undefined,
        source: EmojiSource = SHARED,
    ) {
        this.#userId = userId;
        this.#storage = storage;
        this.#source = source;
        this.recent = storage === undefined ? [] : storedRecent(storage, userId);
    }

    /** No category is in yet, and none has failed. */
    get loading(): boolean {
        return this.categories.every((c) => c === undefined) && !this.failed;
    }

    /** Gets every category's emoji. */
    async load(): Promise<void> {
        try {
            this.categories = await Promise.all(
                EMOJI_CATEGORIES.map((c) => this.#source.inCategory(c.group)),
            );
        } catch (err) {
            console.warn("Couldn't load the emoji", err);
            this.failed = true;
        }
    }

    /** `char` was picked: it goes to the front of Recent, which is kept for next time. */
    picked(char: string): void {
        this.recent = pickedRecently(this.recent, char);
        if (this.#storage !== undefined) storeRecent(this.#storage, this.#userId, this.recent);
    }

    /** Searches for what's typed once typing pauses; nothing typed ends the search. */
    search(query: string): void {
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => void this.#search(query), EMOJI_SEARCH_DELAY_MS);
    }

    async #search(query: string): Promise<void> {
        const run = ++this.#run;
        const q = query.trim();
        if (q === "") {
            this.matches = undefined;
            return;
        }
        try {
            const found = await this.#source.matching(q);
            if (run === this.#run) this.matches = found;
        } catch (err) {
            console.warn("Couldn't search the emoji", err);
        }
    }

    /** Ends the search now, dropping one on its way. */
    clearSearch(): void {
        clearTimeout(this.#timer);
        this.#run += 1;
        this.matches = undefined;
    }

    /** The picker's gone: a search on its way is dropped. */
    dispose(): void {
        clearTimeout(this.#timer);
        this.#run += 1;
    }
}
