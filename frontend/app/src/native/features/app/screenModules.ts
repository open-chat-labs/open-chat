// The screens' chunks (screens.ts), loaded once and kept: a screen whose chunk is in shows at once,
// with nothing in between, and the shell loads the rest while it's idle (`preload`), so going to a
// screen doesn't wait on its chunk. Native screens never show a loader in the middle of the
// screen while they come in (README.md, "Data").

export type ModuleLoader<C> = () => Promise<{ default: C }>;

export class ScreenModules<K extends string, C> {
    readonly #loaders: Partial<Record<K, ModuleLoader<C>>>;
    readonly #loaded = new Map<K, C>();
    readonly #loading = new Map<K, Promise<C>>();

    /** `order`: the kinds `preload` loads first (the tabs' roots), the others after them. */
    constructor(
        loaders: Partial<Record<K, ModuleLoader<C>>>,
        private readonly order: readonly K[] = [],
    ) {
        this.#loaders = loaders;
    }

    /** Whether a kind has a screen (one not built yet shows a placeholder). */
    has(kind: K): boolean {
        return this.#loaders[kind] !== undefined;
    }

    /** A kind's screen once its chunk is in; none before, or for a kind without one. */
    loaded(kind: K): C | undefined {
        return this.#loaded.get(kind);
    }

    /** Whether every one of these kinds can show at once: loaded, or without a screen. */
    ready(kinds: readonly K[]): boolean {
        return kinds.every((kind) => !this.has(kind) || this.#loaded.has(kind));
    }

    /**
     * Loads a kind's chunk (once, however many ask); none for a kind without a screen. A chunk
     * that doesn't load rejects, and the next call tries again.
     */
    load(kind: K): Promise<C | undefined> {
        const loaded = this.#loaded.get(kind);
        if (loaded !== undefined) return Promise.resolve(loaded);
        const loader = this.#loaders[kind];
        if (loader === undefined) return Promise.resolve(undefined);
        let loading = this.#loading.get(kind);
        if (loading === undefined) {
            loading = this.#fetch(kind, loader);
            this.#loading.set(kind, loading);
        }
        return loading;
    }

    async #fetch(kind: K, loader: ModuleLoader<C>): Promise<C> {
        try {
            const module = await loader();
            this.#loaded.set(kind, module.default);
            return module.default;
        } finally {
            this.#loading.delete(kind);
        }
    }

    /** Loads these kinds' chunks together; rejects if one doesn't load. */
    async loadAll(kinds: readonly K[]): Promise<void> {
        await Promise.all(kinds.map((kind) => this.load(kind)));
    }

    /**
     * Loads every screen's chunk, one after another (`order` first), so none waits when it's
     * opened. One that doesn't load is left for when it's opened.
     */
    async preload(): Promise<void> {
        const all = (Object.keys(this.#loaders) as K[]).filter((kind) => this.has(kind));
        const first = this.order.filter((kind) => all.includes(kind));
        for (const kind of [...first, ...all.filter((kind) => !first.includes(kind))]) {
            try {
                await this.load(kind);
            } catch (err) {
                console.warn(`Couldn't preload the ${kind} screen`, err);
            }
        }
    }
}
