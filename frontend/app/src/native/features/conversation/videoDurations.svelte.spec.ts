import { SvelteMap } from "svelte/reactivity";
import { VideoDurations } from "./videoDurations.svelte";

// a reader whose reads are settled by the test, in any order
function reader() {
    const reads: { url: string; signal: AbortSignal; settle: (s: number | undefined) => void }[] =
        [];
    const read = vi.fn(
        (url: string, signal: AbortSignal) =>
            new Promise<number | undefined>((settle) => reads.push({ url, signal, settle })),
    );
    return { read, reads };
}

const videos = (...ids: string[]) => ids.map((id) => ({ id, url: `file:${id}` }));
const settled = () => new Promise((resolve) => setTimeout(resolve));

describe("the lengths of the videos the attach panel shows", () => {
    test("are read a few at a time, in the order shown", async () => {
        const { read, reads } = reader();
        const durations = new VideoDurations(read, new SvelteMap(), 2);
        durations.want(videos("a", "b", "c"));
        expect(reads.map((r) => r.url)).toEqual(["file:a", "file:b"]);
        reads[1].settle(14);
        await settled();
        expect(durations.of("b")).toBe(14);
        expect(reads.map((r) => r.url)).toEqual(["file:a", "file:b", "file:c"]);
    });

    test("are kept once read, and not read again, the next time the panel opens too", async () => {
        const { read, reads } = reader();
        const known = new SvelteMap<string, number>();
        const durations = new VideoDurations(read, known, 2);
        durations.want(videos("a"));
        reads[0].settle(3);
        await settled();
        durations.want(videos("a", "b"));
        expect(reads.map((r) => r.url)).toEqual(["file:a", "file:b"]);
        expect(durations.of("a")).toBe(3);

        const reopened = new VideoDurations(read, known, 2);
        reopened.want(videos("a"));
        expect(read).toHaveBeenCalledTimes(2);
        expect(reopened.of("a")).toBe(3);
    });

    test("one that can't be read moves on to the next, and isn't tried again", async () => {
        const { read, reads } = reader();
        const durations = new VideoDurations(read, new SvelteMap(), 1);
        durations.want(videos("a", "b"));
        reads[0].settle(undefined);
        await settled();
        expect(durations.of("a")).toBeUndefined();
        expect(reads.map((r) => r.url)).toEqual(["file:a", "file:b"]);
        durations.want(videos("a"));
        expect(read).toHaveBeenCalledTimes(2);
    });

    test("stop as the panel goes: those being read let go, those waiting not read", async () => {
        const { read, reads } = reader();
        const durations = new VideoDurations(read, new SvelteMap(), 1);
        durations.want(videos("a", "b"));
        durations.stop();
        expect(reads[0].signal.aborted).toBe(true);
        reads[0].settle(undefined);
        await settled();
        expect(read).toHaveBeenCalledTimes(1);
    });
});
