import { beforeEach, describe, expect, test, vi } from "vitest";

const fakeComponent = { name: "FakeRichTextEditor" };

// Each test gets a fresh loader module and a fresh mock of the editor chunk.
async function fresh(behaviour: () => Promise<{ default: unknown }>) {
    vi.resetModules();
    vi.doMock("./RichTextEditor.svelte", behaviour);
    return import("./richTextEditorLoader");
}

describe("richTextEditorLoader", () => {
    beforeEach(() => {
        vi.doUnmock("./RichTextEditor.svelte");
    });

    test("nothing is loaded until asked; concurrent loads share one import", async () => {
        let importCount = 0;
        const loader = await fresh(async () => {
            importCount++;
            return { default: fakeComponent };
        });
        expect(loader.richTextEditorIfLoaded()).toBeUndefined();
        const [a, b] = await Promise.all([
            loader.loadRichTextEditor(),
            loader.loadRichTextEditor(),
        ]);
        expect(a).toBe(fakeComponent);
        expect(b).toBe(fakeComponent);
        expect(importCount).toBe(1);
        expect(loader.richTextEditorIfLoaded()).toBe(fakeComponent);
        await loader.loadRichTextEditor();
        expect(importCount).toBe(1);
    });

    test("a failed load is retried on the next request", async () => {
        let attempts = 0;
        const loader = await fresh(async () => {
            attempts++;
            if (attempts === 1) throw new Error("chunk failed");
            return { default: fakeComponent };
        });
        await expect(loader.loadRichTextEditor()).rejects.toThrow();
        expect(loader.richTextEditorIfLoaded()).toBeUndefined();
        await expect(loader.loadRichTextEditor()).resolves.toBe(fakeComponent);
        expect(attempts).toBe(2);
    });

    test("warm-up loads at idle and swallows failures", async () => {
        vi.useFakeTimers();
        try {
            let attempts = 0;
            const loader = await fresh(async () => {
                attempts++;
                if (attempts === 1) throw new Error("chunk failed");
                return { default: fakeComponent };
            });
            loader.warmRichTextEditor();
            await vi.runAllTimersAsync();
            expect(loader.richTextEditorIfLoaded()).toBeUndefined();
            loader.warmRichTextEditor();
            await vi.runAllTimersAsync();
            expect(loader.richTextEditorIfLoaded()).toBe(fakeComponent);
        } finally {
            vi.useRealTimers();
        }
    });
});
