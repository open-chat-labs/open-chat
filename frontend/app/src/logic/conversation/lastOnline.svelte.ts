import {
    directChatStatus,
    directChatSubtitle,
    type DirectChatSubtitle,
    type MessageFormatter,
    type OpenChat,
    type UserSummary,
} from "@client";

/** What a DM's line under the name is worked out from, each read as it changes. */
export type LastOnlineSources = {
    /** The other person in the DM, or undefined when the chat isn't a DM. */
    userId: () => string | undefined;
    /** Their summary (a bot or a suspended account says so instead), once it's loaded. */
    user: () => Pick<UserSummary, "kind" | "suspended"> | undefined;
    /** The app clock (`$now`): "Last online 5 minutes ago" moves with it, and it's asked again on each tick. */
    now: () => number;
    formatter: () => MessageFormatter;
};

const NONE: DirectChatSubtitle = { text: "", online: false };

/**
 * A DM's line under the name in every tree's header: when the other person was last online
 * ("Online now", "Last online 5 minutes ago"), "Account suspended", or nothing for a bot
 * (`directChatSubtitle`). When they were last online is asked again on each tick of the clock
 * (`getLastOnlineDate` batches and caches it). An answer only counts for the person it was asked
 * about, so another DM's never shows, and one older than an answer already taken is dropped; a
 * failed lookup keeps what was known. It starts an effect, so it must be built while a component
 * initialises.
 */
export class LastOnline {
    #client: Pick<OpenChat, "getLastOnlineDate">;
    #sources: LastOnlineSources;
    // the last answer taken, and whose it is
    #seen = $state<{ userId: string; at: number | undefined }>();
    // each lookup is numbered; an answer is taken only if it's newer than the last one taken
    #asked = 0;
    #taken = 0;

    // whose last online to ask for: a DM's other person, unless a bot or suspended
    #asking = $derived.by(() => {
        const userId = this.#sources.userId();
        return userId !== undefined && directChatStatus(this.#sources.user()) === "last_online"
            ? userId
            : undefined;
    });

    #line = $derived.by((): DirectChatSubtitle => {
        const userId = this.#sources.userId();
        if (userId === undefined) return NONE;
        const seen = this.#seen?.userId === userId ? this.#seen.at : undefined;
        return directChatSubtitle(
            this.#sources.formatter(),
            this.#sources.user(),
            this.#sources.now(),
            seen,
        );
    });

    constructor(client: Pick<OpenChat, "getLastOnlineDate">, sources: LastOnlineSources) {
        this.#client = client;
        this.#sources = sources;
        $effect(() => {
            const userId = this.#asking;
            const now = this.#sources.now();
            if (userId !== undefined) void this.#ask(userId, now);
        });
    }

    /** The line: empty when it's not a DM, it's a bot's, or when they were last online isn't known yet. */
    get text(): string {
        return this.#line.text;
    }

    /** Whether the other person is online now. */
    get online(): boolean {
        return this.#line.online;
    }

    async #ask(userId: string, now: number): Promise<void> {
        const request = ++this.#asked;
        try {
            const at = await this.#client.getLastOnlineDate(userId, now);
            if (request <= this.#taken) return;
            this.#taken = request;
            this.#seen = { userId, at };
        } catch (err) {
            // the next tick asks again; nothing the user can do about it
            console.warn("Couldn't get when the user was last online", userId, err);
        }
    }
}
