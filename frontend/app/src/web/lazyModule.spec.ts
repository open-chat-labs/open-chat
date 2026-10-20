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
});
