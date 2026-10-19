// A module loaded the first time it's wanted (Learn's content, kept out of Landing's download).
// A load that fails (a flaky network, a chunk gone after a deploy) is remembered, so the page can
// say so, and wanting it again tries again.
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
