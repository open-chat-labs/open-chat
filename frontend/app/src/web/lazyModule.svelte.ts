// A module loaded the first time it's wanted (Learn's content, kept out of Landing's download; a
// region's screen).
// A load that fails (a flaky network, a chunk gone after a deploy) is remembered, so the page can
// say so. Wanting it again calls the load again, but a browser keeps a failed import() failed for
// the page's lifetime, so a real retry is a page reload.
export class LazyModule<M> {
    module = $state<M | undefined>(undefined);
    failed = $state(false);
    #loading = false;

    constructor(private readonly load: () => Promise<M>) {}

    /** Loads it, unless it's loaded or loading; after a failure, tries again. */
    want(): void {
        if (this.module !== undefined || this.#loading) return;
        this.#loading = true;
        this.failed = false;
        this.load()
            .then(
                (module) => (this.module = module),
                (err) => {
                    console.error("Couldn't load a page's content", err);
                    this.failed = true;
                },
            )
            .finally(() => (this.#loading = false));
    }
}
