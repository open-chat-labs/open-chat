import type { ModelFile } from "openchat-shared";
import { webcrypto } from "node:crypto";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearWebModel,
    restoreWebModel,
    setWebModelFile,
    useWebModelFromUrl,
    webInfer,
    webModelModalities,
    webModelStatus,
} from "./webInference";

// Pins the id-tracking contract the always-visible browser chooser relies on: webModelStatus carries
// the CATALOG id of the attached model (so the chooser can mark it "Current"), and the id is cleared
// whenever the source is not a catalog entry (disk file) or the model is removed.
//
// And the VISION contract: what reaches wllama for an image, what happens when the attached model has
// no projector, and how a weights+mmproj pair is downloaded and verified.

const LS_URL_MODEL = "openchat_web_model_url";

// ── wllama double ──────────────────────────────────────────────────────────────────────────────
// Records what webInference hands the runtime, and lets each test dictate what the runtime answers.
const wl = vi.hoisted(() => ({
    imageSupported: true,
    completion: "extracted" as string | undefined,
    throwOnInfer: undefined as string | undefined,
    // captured
    loadedSource: undefined as unknown,
    loadParams: undefined as Record<string, unknown> | undefined,
    loadCount: 0,
    lastMessages: undefined as { role: string; content: unknown }[] | undefined,
    modelSource: undefined as { url: string; mmprojUrl?: string } | undefined,
    progressSeen: [] as { loaded: number; total: number }[],
    removed: false,
    // the cached files getModelOrDownload resolves to
    cached: [] as { url: string; bytes: Uint8Array }[],
}));

vi.mock("@wllama/wllama", () => {
    class Wllama {
        async loadModel(source: unknown, params?: Record<string, unknown>) {
            wl.loadedSource = source;
            wl.loadParams = params;
            wl.loadCount += 1;
        }
        supportInputModality(modality: string): boolean {
            return modality === "image" ? wl.imageSupported : false;
        }
        async createChatCompletion(opts: { messages: { role: string; content: unknown }[] }) {
            wl.lastMessages = opts.messages;
            if (wl.throwOnInfer !== undefined) throw new Error(wl.throwOnInfer);
            return { choices: [{ message: { content: wl.completion } }] };
        }
        async exit() {}
    }
    class ModelManager {
        async getModelOrDownload(
            source: { url: string; mmprojUrl?: string },
            opts?: { progressCallback?: (p: { loaded: number; total: number }) => void },
        ) {
            wl.modelSource = source;
            const total = wl.cached.reduce((acc, f) => acc + f.bytes.length, 0);
            opts?.progressCallback?.({ loaded: total, total });
            wl.progressSeen.push({ loaded: total, total });
            return {
                files: wl.cached.map((f) => ({ metadata: { originalURL: f.url } })),
                open: async () => wl.cached.map((f) => new Blob([f.bytes.slice().buffer as ArrayBuffer])),
                remove: async () => {
                    wl.removed = true;
                },
            };
        }
    }
    return { Wllama, ModelManager };
});

// Two jsdom gaps, not product gaps: it ships no SubtleCrypto, and its Blob has no arrayBuffer()
// (every browser has had it since 2019). Fill both so the REAL verification code runs here.
vi.stubGlobal("crypto", webcrypto);
if (Blob.prototype.arrayBuffer === undefined) {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
        });
    };
}

function file(url: string, sha256: string, bytes: number): ModelFile {
    return { url, sha256, bytes };
}

async function hashOf(bytes: Uint8Array): Promise<string> {
    const digest = await webcrypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function resetWllama() {
    wl.imageSupported = true;
    wl.completion = "extracted";
    wl.throwOnInfer = undefined;
    wl.loadedSource = undefined;
    wl.loadParams = undefined;
    wl.loadCount = 0;
    wl.lastMessages = undefined;
    wl.modelSource = undefined;
    wl.progressSeen = [];
    wl.removed = false;
    wl.cached = [];
}

describe("webModelStatus id tracking", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
    });

    it("restoreWebModel publishes the saved catalog id so the chooser can mark the current model", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                id: "qwen2.5-0.5b-instruct-q4",
                name: "Qwen2.5 0.5B (instruct)",
                url: "https://host/models/qwen2.5-0.5b.gguf",
            }),
        );
        await restoreWebModel();
        const status = get(webModelStatus);
        expect(status.status).toBe("attached");
        expect(status.name).toBe("Qwen2.5 0.5B (instruct)");
        expect(status.id).toBe("qwen2.5-0.5b-instruct-q4");
    });

    it("attaching a session disk file clears the catalog id (disk files have no catalog row)", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                id: "qwen2.5-0.5b-instruct-q4",
                name: "Qwen2.5 0.5B (instruct)",
                url: "https://host/models/qwen2.5-0.5b.gguf",
            }),
        );
        await restoreWebModel();
        const err = await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        expect(err).toBeUndefined();
        const status = get(webModelStatus);
        expect(status.status).toBe("attached");
        expect(status.name).toBe("local-model.gguf");
        expect(status.id).toBeUndefined();
    });

    it("clearWebModel clears the id along with the rest of the state", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({ id: "gemma-3-1b-it-q4", name: "Gemma 3 1B", url: "https://host/g.gguf" }),
        );
        await restoreWebModel();
        expect(get(webModelStatus).id).toBe("gemma-3-1b-it-q4");
        await clearWebModel();
        const status = get(webModelStatus);
        expect(status.status).toBe("none");
        expect(status.id).toBeUndefined();
        expect(status.name).toBeUndefined();
    });
});

// ── the vision path ────────────────────────────────────────────────────────────────────────────

const WEIGHTS = new Uint8Array([1, 2, 3, 4]);
const PROJ = new Uint8Array([5, 6, 7]);
const WEIGHTS_URL = "https://host/models/smolvlm.gguf";
const PROJ_URL = "https://host/models/mmproj-smolvlm.gguf";
const PIXELS = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // a PNG magic number, as bytes

/** Attach a catalog vision entry (weights + projector), skipping the hash check unless asked for. */
async function attachVisionModel(sha: { weights: string; proj: string } = { weights: "", proj: "" }) {
    wl.cached = [
        { url: WEIGHTS_URL, bytes: WEIGHTS },
        { url: PROJ_URL, bytes: PROJ },
    ];
    return useWebModelFromUrl({
        id: "smolvlm-256m-instruct-q8",
        name: "SmolVLM 256M (vision)",
        files: [file(WEIGHTS_URL, sha.weights, WEIGHTS.length), file(PROJ_URL, sha.proj, PROJ.length)],
        sizeBytes: WEIGHTS.length + PROJ.length,
        modalities: ["text", "image"],
    });
}

describe("webInfer", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("a TEXT request still sends a plain string prompt — the vision path changes nothing here", async () => {
        await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        const res = await webInfer({ prompt: "extract this", text: "Total: £12" });
        expect(res).toEqual({ kind: "ok", text: "extracted" });
        expect(wl.lastMessages).toEqual([{ role: "user", content: "extract this\n\nTotal: £12" }]);
    });

    it("an IMAGE request sends the raw file bytes as OAI image content, picture before question", async () => {
        // This is the whole feature: it used to return `unavailable` before ever reaching wllama.
        await attachVisionModel();
        const res = await webInfer({ prompt: "read this receipt", image: PIXELS });
        expect(res).toEqual({ kind: "ok", text: "extracted" });

        const content = wl.lastMessages?.[0].content as { type: string; data?: ArrayBuffer; text?: string }[];
        expect(content.map((c) => c.type)).toEqual(["image", "text"]); // VLMs are trained image-first
        expect(new Uint8Array(content[0].data!)).toEqual(PIXELS);
        expect(content[1].text).toBe("read this receipt");
    });

    it("the image ArrayBuffer is exactly the image, not the pooled buffer a view sits in", async () => {
        // A Uint8Array is usually a WINDOW onto a bigger buffer; wllama copies the whole buffer, so
        // passing `.buffer` would ship neighbouring bytes into the model.
        await attachVisionModel();
        const pool = new Uint8Array([9, 9, 0x89, 0x50, 0x4e, 0x47, 9, 9]);
        const view = pool.subarray(2, 6);
        await webInfer({ prompt: "read", image: view });
        const content = wl.lastMessages?.[0].content as { data?: ArrayBuffer }[];
        expect(content[0].data!.byteLength).toBe(4);
        expect(new Uint8Array(content[0].data!)).toEqual(PIXELS);
    });

    it("an image against a model with NO projector is 'unavailable' and names the remedy", async () => {
        // The loaded model is asked, not the catalog — so a mislabelled entry degrades cleanly instead
        // of throwing "Media marker is undefined" from inside wllama.
        wl.imageSupported = false;
        await attachVisionModel();
        const res = await webInfer({ prompt: "read this", image: PIXELS });
        expect(res.kind).toBe("unavailable");
        expect(res.kind === "unavailable" && res.reason).toMatch(/vision model|mmproj/);
        expect(wl.lastMessages).toBeUndefined(); // never reached the model
    });

    it("with no model attached an image is still 'unavailable', exactly as before", async () => {
        const res = await webInfer({ prompt: "read this", image: PIXELS });
        expect(res).toEqual({ kind: "unavailable", reason: "no browser model attached" });
    });
});

// Reported from real use: proposing on a photo died with "Action failed: (ABORT)". The cause was
// llama.cpp's WebGPU backend aborting inside clip_image_batch_encode once a dynamic-resolution VLM
// turned a large photo into too many patches — measured threshold between 1024 and 2048 image
// tokens on Qwen3-VL. Two defects, two fixes, both pinned here.
describe("oversized-image crash", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("caps image tokens at load time — the guard that stops the encoder aborting at all", async () => {
        await attachVisionModel();
        await webInfer({ prompt: "hi" });
        // The VALUE is a measured crash threshold, not a preference: 768 passed a 12 MP photo with
        // full accuracy, 2048 aborted. Assert it is set and safely under the observed limit.
        expect(wl.loadParams?.image_max_tokens).toBeDefined();
        expect(wl.loadParams?.image_max_tokens as number).toBeLessThan(2048);
    });

    it("a wasm abort is reported in words a user can act on, not as '(ABORT)'", async () => {
        await attachVisionModel();
        wl.throwOnInfer = "(ABORT) ";
        const res = await webInfer({ prompt: "read this", image: PIXELS });
        expect(res.kind).toBe("error");
        expect(res.kind === "error" && res.error).toMatch(/image/i);
        expect(res.kind === "error" && res.error).not.toMatch(/ABORT/);
    });

    it("a wasm abort DROPS the runtime, so the next inference isn't poisoned too", async () => {
        // An emscripten abort kills the module: every later call on that instance fails as well.
        // Leaving it resident turned one bad image into a dead model for the rest of the session.
        await attachVisionModel();
        await webInfer({ prompt: "hi" });
        expect(wl.loadCount).toBe(1);

        wl.throwOnInfer = "(ABORT) ";
        expect((await webInfer({ prompt: "read", image: PIXELS })).kind).toBe("error");

        wl.throwOnInfer = undefined;
        const after = await webInfer({ prompt: "hi again" });
        expect(after).toEqual({ kind: "ok", text: "extracted" });
        expect(wl.loadCount).toBe(2); // rebuilt, not reused
    });

    it("a non-abort error is passed through untouched", async () => {
        await attachVisionModel();
        wl.throwOnInfer = "kv cache full";
        const res = await webInfer({ prompt: "hi" });
        expect(res).toEqual({ kind: "error", error: "kv cache full" });
    });
});

describe("useWebModelFromUrl with a projector", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("downloads weights AND mmproj as one ModelSource, and loads the pair together", async () => {
        expect(await attachVisionModel()).toBeUndefined();
        expect(wl.modelSource).toEqual({ url: WEIGHTS_URL, mmprojUrl: PROJ_URL });
        expect(get(webModelStatus).status).toBe("attached");
        await webInfer({ prompt: "hi" }); // forces the load
        expect((wl.loadedSource as { files: unknown[] }).files.length).toBe(2);
    });

    it("progress covers the PAIR, so the bar doesn't stall at the weights' share", async () => {
        await attachVisionModel();
        expect(wl.progressSeen.at(-1)).toEqual({
            loaded: WEIGHTS.length + PROJ.length,
            total: WEIGHTS.length + PROJ.length,
        });
    });

    it("persists the projector URL so the model re-attaches whole on the next visit", async () => {
        await attachVisionModel();
        const saved = JSON.parse(localStorage.getItem(LS_URL_MODEL)!);
        expect(saved.url).toBe(WEIGHTS_URL);
        expect(saved.mmprojUrl).toBe(PROJ_URL);
        expect(saved.modalities).toEqual(["text", "image"]);

        await clearWebModel();
        localStorage.setItem(LS_URL_MODEL, JSON.stringify(saved));
        await restoreWebModel();
        resetWllama();
        wl.cached = [
            { url: WEIGHTS_URL, bytes: WEIGHTS },
            { url: PROJ_URL, bytes: PROJ },
        ];
        await webInfer({ prompt: "hi" });
        expect(wl.modelSource).toEqual({ url: WEIGHTS_URL, mmprojUrl: PROJ_URL });
    });

    it("verifies BOTH files against the catalog SHA-256 and accepts a matching pair", async () => {
        const err = await attachVisionModel({
            weights: await hashOf(WEIGHTS),
            proj: await hashOf(PROJ),
        });
        expect(err).toBeUndefined();
        expect(wl.removed).toBe(false);
        expect(get(webModelStatus).status).toBe("attached");
    });

    it("a corrupt PROJECTOR is caught, discarded and named — not just the weights", async () => {
        const err = await attachVisionModel({
            weights: await hashOf(WEIGHTS),
            proj: "0".repeat(64),
        });
        expect(err).toMatch(/mmproj-smolvlm\.gguf/);
        expect(err).toMatch(/SHA-256/);
        expect(wl.removed).toBe(true); // corrupt bytes don't stay in the cache
        expect(get(webModelStatus).status).toBe("error");
    });

    it("refuses a layout the browser can't load, before spending a byte of bandwidth", async () => {
        const err = await useWebModelFromUrl({
            id: "sharded",
            name: "Sharded",
            files: [
                file("https://host/m-00001-of-00002.gguf", "", 10),
                file("https://host/m-00002-of-00002.gguf", "", 10),
            ],
            sizeBytes: 20,
        });
        expect(err).toMatch(/file layout/);
        expect(wl.modelSource).toBeUndefined();
    });
});

describe("webModelModalities", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("reports nothing readable with no model attached", () => {
        expect(webModelModalities()).toEqual(["text"]);
    });

    it("a disk-picked file is text until a load proves otherwise", async () => {
        await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        expect(webModelModalities()).toEqual(["text"]);
    });

    it("a downloaded catalog vision entry claims image BEFORE the weights are in memory", async () => {
        // The propose gate runs before any inference, so an attached-but-not-yet-loaded model has to
        // answer from the catalog — otherwise the first propose on an image is always refused.
        await attachVisionModel();
        expect(webModelModalities()).toEqual(["text", "image"]);
    });

    it("the LOADED model overrides the catalog's claim when the catalog is wrong", async () => {
        wl.imageSupported = false;
        await attachVisionModel(); // entry claims ["text","image"]
        expect(webModelModalities()).toEqual(["text", "image"]); // claim, pre-load
        await webInfer({ prompt: "hi" }); // loads, and measures
        expect(webModelModalities()).toEqual(["text"]); // measurement wins
    });

    it("a loaded vision model reports image from the runtime, not the catalog", async () => {
        await attachVisionModel();
        await webInfer({ prompt: "hi" });
        expect(webModelModalities()).toEqual(["text", "image"]);
    });
});
