import {
    i18nKey,
    type ChatMap,
    type ResourceKey,
    type ThreadPreview,
    type ThreadSyncDetails,
} from "@client";

// The previews of the threads the reader follows (the list of threads), loaded as every tree
// loads them: at once the first time, then each time the followed threads change, once they've
// settled for a moment. The list loaded stays up while the next one loads; a failed load shows
// none, and says so once.

export const THREAD_PREVIEWS_DEBOUNCE_MS = 300;

/** The previews: still loading the first time, then the latest loaded (none if that failed). */
export type ThreadPreviewsState =
    | { kind: "loading" }
    | { kind: "loaded"; threads: ThreadPreview[] };

/** How the previews are loaded (`client.threadPreviews`): undefined when that failed. */
export type LoadThreadPreviews = (
    threadsByChat: ChatMap<ThreadSyncDetails[]>,
) => Promise<ThreadPreview[] | undefined>;

export class ThreadPreviews {
    #load: LoadThreadPreviews;
    #delay: number;
    #timer: ReturnType<typeof setTimeout> | undefined;
    // the call still waiting for its timer, settled with nothing if a later one replaces it
    #waiting: ((failure: ResourceKey | undefined) => void) | undefined;
    // the latest load asked for: an older one's answer is dropped
    #asked = 0;
    #loadedOnce = false;

    previews = $state<ThreadPreviewsState>({ kind: "loading" });

    constructor(load: LoadThreadPreviews, delay: number = THREAD_PREVIEWS_DEBOUNCE_MS) {
        this.#load = load;
        this.#delay = delay;
    }

    /**
     * The followed threads changed (`threadsByChatStore`): loads their previews, at once the first
     * time and after that once they've stopped changing. Settles with the failure to show if this
     * load failed, and with nothing once it has loaded, or when a later change replaced it.
     */
    set(threadsByChat: ChatMap<ThreadSyncDetails[]>): Promise<ResourceKey | undefined> {
        clearTimeout(this.#timer);
        this.#waiting?.(undefined);
        this.#waiting = undefined;
        const asked = ++this.#asked;
        return new Promise((resolve) => {
            if (!this.#loadedOnce) {
                this.#loadedOnce = true;
                void this.#run(threadsByChat, asked, resolve);
                return;
            }
            this.#waiting = resolve;
            this.#timer = setTimeout(() => {
                this.#waiting = undefined;
                void this.#run(threadsByChat, asked, resolve);
            }, this.#delay);
        });
    }

    /** Stops a load still waiting (the list is going away). */
    dispose(): void {
        clearTimeout(this.#timer);
        this.#waiting?.(undefined);
        this.#waiting = undefined;
        this.#asked++;
    }

    async #run(
        threadsByChat: ChatMap<ThreadSyncDetails[]>,
        asked: number,
        settle: (failure: ResourceKey | undefined) => void,
    ): Promise<void> {
        const threads = await this.#load(threadsByChat);
        if (asked !== this.#asked) {
            settle(undefined);
            return;
        }
        this.previews = { kind: "loaded", threads: threads ?? [] };
        settle(threads === undefined ? i18nKey("thread.previewFailure") : undefined);
    }
}
