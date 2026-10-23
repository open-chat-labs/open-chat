// A module loaded the first time it's wanted (Learn's content, kept out of Landing's download; a
// region's screen).
// A load that fails (a flaky network, a chunk gone after a deploy) is remembered, so the page can
// say so. Wanting it again calls the load again, but a browser keeps a failed import() failed for
// the page's lifetime, so a real retry is a page reload.

// how long a load runs before it's worth showing that it's loading
const SLOW_AFTER_MS = 250;

export class LazyModule<M> {
    module = $state<M | undefined>(undefined);
    failed = $state(false);
    // still loading after a moment: a quick load shows no spinner, only what it loaded
    slow = $state(false);
    #loading = false;
    // wanted while it was loading ahead: a failure is then one
    #wanted = false;

    constructor(private readonly load: () => Promise<M>) {}

    /** Loads it, unless it's loaded or loading; after a failure, tries again. */
    want(): void {
        if (this.module !== undefined) return;
        if (this.#loading) {
            this.#wanted = true;
            return;
        }
        this.#loading = true;
        this.failed = false;
        this.#fetch(true);
    }

    /**
     * Loads it ahead of being wanted. A failure isn't one yet: nothing asked for it, and wanting it
     * later loads it again.
     */
    prefetch(): void {
        if (this.module !== undefined || this.#loading) return;
        this.#loading = true;
        this.#fetch(false);
    }

    async #fetch(wanted: boolean): Promise<void> {
        const slow = setTimeout(() => (this.slow = true), SLOW_AFTER_MS);
        try {
            this.module = await this.load();
        } catch (err) {
            if (wanted || this.#wanted) {
                console.error("Couldn't load a page's content", err);
                this.failed = true;
            } else {
                console.warn("Couldn't load a page's content ahead", err);
            }
        } finally {
            clearTimeout(slow);
            this.slow = false;
            this.#loading = false;
            this.#wanted = false;
        }
    }
}
