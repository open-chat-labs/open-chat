import { flushSync, tick } from "svelte";
import { createClassComponent } from "svelte/legacy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebInferenceRuntimeSettings from "./WebInferenceRuntimeSettings.svelte";
import {
    deleteTransformersWebGpuAudio,
    preloadTransformersWebGpuAudio,
    transformersWebGpuAudioDownloaded,
} from "../utils/transformersWebGpuInference";

vi.mock("../utils/transformersWebGpuInference", () => ({
    deleteTransformersWebGpuAudio: vi.fn(),
    preloadTransformersWebGpuAudio: vi.fn(),
    transformersWebGpuAudioDownloaded: vi.fn(),
    transformersWebGpuSelectionCanHandle: () => true,
}));

const GEMMA = "gemma-4-e2b-it-q4";
const QWEN = "qwen3-vl-2b-instruct-q4";
const download = vi.mocked(preloadTransformersWebGpuAudio);
const verify = vi.mocked(transformersWebGpuAudioDownloaded);
const remove = vi.mocked(deleteTransformersWebGpuAudio);
const cleanup: (() => void)[] = [];

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}

async function settle() {
    await tick();
    await tick();
    flushSync();
}

function render() {
    const target = document.createElement("div");
    document.body.append(target);
    // The compatibility wrapper provides real reactive prop updates to the compiled Svelte 5
    // component. All model I/O is mocked; effects, event handlers and teardown are real.
    const component = createClassComponent({
        component: WebInferenceRuntimeSettings,
        target,
        props: { context: "phone" as const, modelId: GEMMA, modelName: "Gemma" },
    });
    let destroyed = false;
    const destroy = () => {
        if (!destroyed) component.$destroy();
        destroyed = true;
        target.remove();
    };
    cleanup.push(destroy);
    return {
        target,
        destroy,
        switchTo(modelId: string) {
            component.$set({ modelId, modelName: modelId });
            flushSync();
        },
        button(label: string) {
            const button = Array.from(target.querySelectorAll("button")).find((item) =>
                item.textContent?.includes(label),
            );
            expect(button, `missing button: ${label}`).toBeDefined();
            return button!;
        },
    };
}

beforeEach(() => {
    download.mockReset().mockResolvedValue(undefined);
    verify.mockReset().mockResolvedValue(false);
    remove.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
    cleanup.splice(0).forEach((destroy) => destroy());
});

describe("optional voice settings component lifecycle", () => {
    it("installs and verifies the captured model while showing actual progress", async () => {
        const pending = deferred<void>();
        download.mockReturnValueOnce(pending.promise);
        const view = render();
        await settle();
        verify.mockResolvedValue(true);
        view.button("Install voice support").click();
        await settle();
        expect(download).toHaveBeenCalledWith(GEMMA, expect.any(Object));
        download.mock.calls[0][1]?.onProgress?.(50, 100);
        await settle();
        expect(view.target.querySelector("progress")?.value).toBe(50);
        pending.resolve();
        await settle();
        expect(verify.mock.calls.map(([id]) => id)).toEqual([GEMMA, GEMMA]);
        expect(view.target.textContent).toContain("Voice-message support installed.");
        expect(view.button("Remove voice support").disabled).toBe(false);
    });

    it("aborts a switched-away install and ignores its late progress and completion after a new install", async () => {
        const first = deferred<void>();
        const second = deferred<void>();
        download.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const view = render();
        await settle();
        view.button("Install voice support").click();
        await settle();
        const firstOptions = download.mock.calls[0][1];
        view.switchTo(QWEN);
        await settle();
        expect(firstOptions?.signal?.aborted).toBe(true);
        expect(view.target.textContent).not.toContain("voice add-on");
        view.switchTo(GEMMA);
        await settle();
        view.button("Install voice support").click();
        await settle();
        firstOptions?.onProgress?.(99, 100);
        first.resolve();
        await settle();
        expect(view.target.querySelector("progress")?.value).toBe(0);
        expect(view.button("Downloading voice support").disabled).toBe(true);
        expect(verify.mock.calls.map(([id]) => id)).toEqual([GEMMA, GEMMA]);
        verify.mockResolvedValue(true);
        second.resolve();
        await settle();
        expect(view.target.textContent).toContain("Voice-message support installed.");
        expect(remove).not.toHaveBeenCalled();
    });

    it.each(["resolve", "reject"] as const)(
        "ignores a late download %s after component destruction",
        async (outcome) => {
            const pending = deferred<void>();
            download.mockReturnValueOnce(pending.promise);
            const view = render();
            await settle();
            view.button("Install voice support").click();
            await settle();
            const options = download.mock.calls[0][1];
            view.destroy();
            expect(options?.signal?.aborted).toBe(true);
            options?.onProgress?.(1, 2);
            if (outcome === "resolve") pending.resolve();
            else pending.reject(new Error("late network failure"));
            await settle();
            expect(verify).toHaveBeenCalledExactlyOnceWith(GEMMA);
            expect(view.target.textContent).toBe("");
            expect(remove).not.toHaveBeenCalled();
        },
    );

    it("ignores verification that finishes after switching to another model", async () => {
        const pending = deferred<boolean>();
        verify.mockResolvedValueOnce(false).mockReturnValueOnce(pending.promise);
        const view = render();
        await settle();
        view.button("Install voice support").click();
        await settle();
        expect(verify).toHaveBeenCalledTimes(2);
        view.switchTo(QWEN);
        pending.resolve(true);
        await settle();
        expect(view.target.textContent).not.toContain("Voice-message support installed.");
        view.switchTo(GEMMA);
        await settle();
        expect(view.button("Install voice support").disabled).toBe(false);
    });

    it("keeps removal bound to its original audio add-on and ignores a switched-away failure", async () => {
        const pending = deferred<void>();
        verify.mockResolvedValueOnce(true);
        remove.mockReturnValueOnce(pending.promise);
        const view = render();
        await settle();
        view.button("Remove voice support").click();
        await settle();
        expect(remove).toHaveBeenCalledExactlyOnceWith(GEMMA);
        view.switchTo(QWEN);
        pending.reject(new Error("old add-on removal failed"));
        await settle();
        expect(view.target.textContent).not.toContain("old add-on removal failed");
        expect(verify).toHaveBeenCalledExactlyOnceWith(GEMMA);
        expect(download).not.toHaveBeenCalled();
    });
});
