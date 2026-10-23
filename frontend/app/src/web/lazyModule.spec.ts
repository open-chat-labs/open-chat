import { LazyModule } from "./lazyModule.svelte";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("a module loaded when it's first wanted", () => {
    test("loads once, however often it's wanted", async () => {
        const load = vi.fn(async () => ({ content: 1 }));
        const lazy = new LazyModule(load);
        lazy.want();
        lazy.want();
        await flush();
        lazy.want();
        expect(load).toHaveBeenCalledOnce();
        expect(lazy.module).toEqual({ content: 1 });
    });

    test("remembers a failed load, and wanting it again tries again", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const load = vi
            .fn()
            .mockRejectedValueOnce(new Error("chunk gone"))
            .mockResolvedValueOnce({ content: 2 });
        const lazy = new LazyModule(load);
        lazy.want();
        await flush();
        expect([lazy.failed, lazy.module]).toEqual([true, undefined]);
        lazy.want();
        expect(lazy.failed).toBe(false);
        await flush();
        expect(lazy.module).toEqual({ content: 2 });
        expect(load).toHaveBeenCalledTimes(2);
    });

    test("is slow only once it has been loading a moment", async () => {
        vi.useFakeTimers();
        let done: (m: { content: number }) => void = () => {};
        const lazy = new LazyModule(() => new Promise<{ content: number }>((r) => (done = r)));
        lazy.want();
        await vi.advanceTimersByTimeAsync(100);
        expect(lazy.slow).toBe(false);
        await vi.advanceTimersByTimeAsync(200);
        expect(lazy.slow).toBe(true);
        done({ content: 3 });
        await vi.advanceTimersByTimeAsync(0);
        expect([lazy.slow, lazy.module]).toEqual([false, { content: 3 }]);
        vi.useRealTimers();
    });

    test("a quick load is never slow", async () => {
        vi.useFakeTimers();
        const lazy = new LazyModule(async () => ({ content: 4 }));
        lazy.want();
        await vi.advanceTimersByTimeAsync(1000);
        expect([lazy.slow, lazy.module]).toEqual([false, { content: 4 }]);
        vi.useRealTimers();
    });
});
