import { SvelteMap } from "svelte/reactivity";

// The lengths of the phone's videos the attach panel shows (06: each video tile with its length),
// which the plugin doesn't list: each read from the file itself (its metadata), a few at a time in
// the order shown, so a hundred don't load at once as the panel opens. Kept once read (`known`, the
// next time the panel opens); one that can't be read isn't tried again while the panel's open.

/** Reads a video's length in seconds (undefined where it can't), stopping on `signal`. */
export type ReadDuration = (url: string, signal: AbortSignal) => Promise<number | undefined>;

/** How many are read at once. */
export const READ_AT_ONCE = 2;

export class VideoDurations {
    // asked for: read, being read, or not to be read again
    #asked = new Set<string>();
    #queue: { id: string; url: string }[] = [];
    #reading = new Map<string, AbortController>();
    readonly #read: ReadDuration;
    readonly #seconds: SvelteMap<string, number>;
    readonly #atOnce: number;

    /** `known`: the lengths read, kept across the panel's openings. */
    constructor(
        read: ReadDuration,
        known: SvelteMap<string, number> = new SvelteMap(),
        atOnce: number = READ_AT_ONCE,
    ) {
        this.#read = read;
        this.#seconds = known;
        this.#atOnce = atOnce;
    }

    /** Its length in seconds, once it's been read. */
    of(id: string): number | undefined {
        return this.#seconds.get(id);
    }

    /** Reads the lengths of these (in this order), those asked for before skipped. */
    want(videos: readonly { id: string; url: string }[]): void {
        for (const video of videos) {
            if (this.#asked.has(video.id) || this.#seconds.has(video.id)) continue;
            this.#asked.add(video.id);
            this.#queue.push(video);
        }
        this.#next();
    }

    /** The panel's gone: those waiting aren't read, and those being read stop. */
    stop(): void {
        this.#queue = [];
        this.#reading.forEach((reading) => reading.abort());
        this.#reading.clear();
    }

    #next() {
        while (this.#reading.size < this.#atOnce && this.#queue.length > 0) {
            const video = this.#queue.shift();
            if (video !== undefined) void this.#readOne(video.id, video.url);
        }
    }

    async #readOne(id: string, url: string) {
        const reading = new AbortController();
        this.#reading.set(id, reading);
        let seconds: number | undefined;
        try {
            seconds = await this.#read(url, reading.signal);
        } catch (err) {
            console.warn("Couldn't read a video's length", err);
        }
        if (reading.signal.aborted) return;
        this.#reading.delete(id);
        if (seconds !== undefined && Number.isFinite(seconds)) this.#seconds.set(id, seconds);
        this.#next();
    }
}

/** A video's length, read from its metadata by a <video> that lets the file go once it has it. */
export function readVideoDuration(url: string, signal: AbortSignal): Promise<number | undefined> {
    return new Promise((resolve) => {
        const probe = document.createElement("video");
        const done = (seconds: number | undefined) => {
            probe.onloadedmetadata = null;
            probe.onerror = null;
            signal.removeEventListener("abort", aborted);
            probe.removeAttribute("src");
            probe.load();
            resolve(seconds);
        };
        const aborted = () => done(undefined);
        probe.preload = "metadata";
        probe.muted = true;
        probe.onloadedmetadata = () => done(probe.duration);
        probe.onerror = () => done(undefined);
        signal.addEventListener("abort", aborted, { once: true });
        probe.src = url;
    });
}
