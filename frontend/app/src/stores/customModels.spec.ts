import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    addCustomModel,
    type CustomModelEntry,
    fileNameFromUrl,
    getCustomModels,
    makeCustomModelId,
    MAX_CUSTOM_MODELS,
    recordDownloadedHashes,
    removeCustomModel,
    shortHash,
    slug,
} from "./customModels";

// A minimal valid custom entry for CRUD tests.
function entry(overrides: Partial<CustomModelEntry> = {}): CustomModelEntry {
    const url = overrides.sourceUrl ?? "https://host/model.gguf";
    return {
        id: overrides.id ?? makeCustomModelId(url),
        name: "My model",
        modalities: ["text"],
        runtime: "llama-cpp",
        files: [{ url, bytes: 1000 }],
        license: "User-provided",
        sizeBytes: 1000,
        custom: true,
        sourceUrl: url,
        addedAt: 0,
        ...overrides,
    };
}

describe("id/slug helpers", () => {
    it("fileNameFromUrl strips query and takes the last segment", () => {
        expect(fileNameFromUrl("https://host/a/b/model-Q4.gguf?download=1")).toBe("model-Q4.gguf");
        expect(fileNameFromUrl("https://host/")).toBe("");
    });

    it("slug is filesystem-safe, bounded, and never empty", () => {
        expect(slug("Model Q4_K_M.gguf")).toMatch(/^[a-z0-9._-]+$/);
        expect(slug("../../etc")).toMatch(/^[a-z0-9._-]+$/);
        expect(slug("")).toBe("model");
        expect(slug("!!!")).toBe("model");
        expect(slug("x".repeat(100)).length).toBeLessThanOrEqual(40);
    });

    it("shortHash is deterministic and stable", () => {
        expect(shortHash("https://host/a.gguf")).toBe(shortHash("https://host/a.gguf"));
        expect(shortHash("https://host/a.gguf")).not.toBe(shortHash("https://host/b.gguf"));
    });

    it("makeCustomModelId is stable per URL, distinct across URLs, and filesystem-safe", () => {
        const a = "https://host/repo/resolve/main/model-Q4_K_M.gguf";
        const b = "https://other/repo/resolve/main/model-Q4_K_M.gguf"; // same filename, different source
        expect(makeCustomModelId(a)).toBe(makeCustomModelId(a));
        expect(makeCustomModelId(a)).not.toBe(makeCustomModelId(b));
        expect(makeCustomModelId(a)).toMatch(/^[A-Za-z0-9._-]+$/);
        // The .gguf extension is dropped from the slug portion.
        expect(makeCustomModelId(a)).toContain("model-q4_k_m");
    });
});

describe("custom-models store", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("adds a model and reflects it in the store", () => {
        const e = entry();
        expect(addCustomModel(e)).toEqual({ ok: true });
        const list = getCustomModels();
        expect(list.map((m) => m.id)).toEqual([e.id]);
    });

    it("rejects a duplicate id", () => {
        const e = entry();
        expect(addCustomModel(e).ok).toBe(true);
        const dup = addCustomModel(e);
        expect(dup.ok).toBe(false);
        expect(getCustomModels()).toHaveLength(1);
    });

    it("enforces the count cap", () => {
        for (let i = 0; i < MAX_CUSTOM_MODELS; i++) {
            expect(addCustomModel(entry({ sourceUrl: `https://host/m${i}.gguf` })).ok).toBe(true);
        }
        const overflow = addCustomModel(entry({ sourceUrl: "https://host/one-too-many.gguf" }));
        expect(overflow.ok).toBe(false);
        expect(getCustomModels()).toHaveLength(MAX_CUSTOM_MODELS);
    });

    it("removes a model", () => {
        const e = entry();
        addCustomModel(e);
        removeCustomModel(e.id);
        expect(getCustomModels()).toHaveLength(0);
    });

    it("records downloaded hashes onto the matching entry's files by URL", () => {
        const url = "https://host/model.gguf";
        const e = entry({ sourceUrl: url, files: [{ url, bytes: 1000 }] });
        addCustomModel(e);
        recordDownloadedHashes(e.id, [{ url, sha256: "abc123" }]);
        expect(getCustomModels()[0].files[0].sha256).toBe("abc123");
    });

    it("survives corrupt localStorage without throwing", () => {
        localStorage.setItem("openchat_custom_models", "{not valid json");
        // A fresh add still works (load() swallows the parse error and starts empty).
        expect(addCustomModel(entry()).ok).toBe(true);
        expect(getCustomModels()).toHaveLength(1);
    });
});

describe("custom-models store — edge cases", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("recordDownloadedHashes leaves a file untouched when no URL matches", () => {
        const url = "https://host/model.gguf";
        const e = entry({ sourceUrl: url, files: [{ url, bytes: 1000 }] });
        addCustomModel(e);
        recordDownloadedHashes(e.id, [{ url: "https://other/x.gguf", sha256: "deadbeef" }]);
        expect(getCustomModels()[0].files[0].sha256).toBeUndefined();
    });

    it("recordDownloadedHashes is a no-op for an empty file list or an unknown id", () => {
        const e = entry();
        addCustomModel(e);
        recordDownloadedHashes(e.id, []); // empty ⇒ early return
        recordDownloadedHashes("no-such-id", [{ url: e.sourceUrl, sha256: "abc" }]); // wrong id
        expect(getCustomModels()[0].files[0].sha256).toBeUndefined();
    });

    it("removing a non-existent id leaves the list unchanged", () => {
        const e = entry();
        addCustomModel(e);
        removeCustomModel("does-not-exist");
        expect(getCustomModels()).toHaveLength(1);
    });

    it("re-adding the same source URL is rejected — makeCustomModelId is stable ⇒ dedupe", () => {
        const url = "https://host/repo/resolve/main/model.gguf";
        expect(addCustomModel(entry({ sourceUrl: url })).ok).toBe(true);
        // different entry object, same URL ⇒ same id ⇒ duplicate
        const again = addCustomModel(entry({ sourceUrl: url, name: "Renamed" }));
        expect(again.ok).toBe(false);
        expect(getCustomModels()).toHaveLength(1);
    });

    it("surfaces a storage error (quota exceeded) and persists nothing", () => {
        const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
        });
        try {
            const res = addCustomModel(entry());
            expect(res.ok).toBe(false);
            if (!res.ok) expect(res.error).toMatch(/storage may be full/i);
        } finally {
            spy.mockRestore();
        }
        // Nothing was written — localStorage (the source of truth) has no entry. (getCustomModels()
        // reads the module-level in-memory store, which a failed persist deliberately does NOT advance.)
        expect(localStorage.getItem("openchat_custom_models")).toBeNull();
    });
});
