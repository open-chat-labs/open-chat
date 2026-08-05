import type { ModelCatalogEntry } from "openchat-shared";
import { describe, expect, it } from "vitest";
import {
    defaultModelCatalog,
    isMmprojFile,
    mergeCatalogs,
    splitModelFiles,
    WEB_MODEL_MAX_BYTES,
    webEligibleModels,
} from "./modelCatalog";

// These specs pin the integrity of the built-in catalog DATA. The catalog is BYO-model: entries only
// point at publicly hosted files (with a SHA-256 to verify after download). If an edit corrupts a hash,
// a byte count, or the size accounting, these tests fail — because a caller downloads and verifies
// against exactly these values.

const HEX_64 = /^[0-9a-f]{64}$/;

describe("defaultModelCatalog", () => {
    it("is a versioned, non-empty catalog", () => {
        expect(defaultModelCatalog.version).toBeGreaterThan(0);
        expect(Array.isArray(defaultModelCatalog.models)).toBe(true);
        expect(defaultModelCatalog.models.length).toBeGreaterThan(0);
    });

    it("has unique, stable, filesystem-safe model ids", () => {
        const ids = defaultModelCatalog.models.map((m) => m.id);
        // Unique.
        expect(new Set(ids).size).toBe(ids.length);
        // Stable + filesystem-safe (the id is the local store key).
        for (const id of ids) {
            expect(id.length).toBeGreaterThan(0);
            expect(id).toMatch(/^[A-Za-z0-9._-]+$/);
        }
    });

    it("includes the Gemma multimodal entry with the expected runtime + modalities", () => {
        const entry = defaultModelCatalog.models.find((m) => m.id === "gemma-4-e2b-it-q4");
        expect(entry).toBeDefined();
        expect(entry!.runtime).toBe("llama-cpp");
        // Multimodal: understands both text and images.
        expect(entry!.modalities).toEqual(expect.arrayContaining(["text", "image"]));
    });

    it("matches the license declared by the exact pinned Gemma repository revision", () => {
        const entry = defaultModelCatalog.models.find((m) => m.id === "gemma-4-e2b-it-q4");
        expect(entry).toMatchObject({
            license: "Apache-2.0",
            licenseUrl: "https://ai.google.dev/gemma/docs/gemma_4_license",
        });
    });

    describe.each(defaultModelCatalog.models.map((m) => [m.id, m] as const))(
        "entry %s",
        (_id, entry) => {
            it("declares a supported runtime and non-empty modalities", () => {
                expect(entry.runtime).toBe("llama-cpp");
                expect(entry.modalities.length).toBeGreaterThan(0);
                for (const modality of entry.modalities) {
                    expect(["text", "image"]).toContain(modality);
                }
            });

            it("carries display metadata and a licence", () => {
                expect(entry.name.length).toBeGreaterThan(0);
                expect(entry.license.length).toBeGreaterThan(0);
            });

            it("lists at least one file, each with a hex SHA-256 and positive byte count", () => {
                expect(entry.files.length).toBeGreaterThan(0);
                for (const file of entry.files) {
                    expect(file.url.length).toBeGreaterThan(0);
                    expect(file.url).toMatch(/^https:\/\//);
                    // Hex-encoded SHA-256 (64 hex chars) — verified after download.
                    expect(file.sha256).toMatch(HEX_64);
                    expect(Number.isInteger(file.bytes)).toBe(true);
                    expect(file.bytes).toBeGreaterThan(0);
                }
            });

            it("pins every remote artifact to an immutable repository revision", () => {
                for (const file of entry.files) {
                    const url = new URL(file.url);
                    expect(url.hostname).toBe("huggingface.co");
                    expect(url.pathname).toMatch(/\/resolve\/[0-9a-f]{40}\//);
                }
            });

            it("has distinct file URLs and hashes", () => {
                const urls = entry.files.map((f) => f.url);
                const hashes = entry.files.map((f) => f.sha256);
                expect(new Set(urls).size).toBe(urls.length);
                expect(new Set(hashes).size).toBe(hashes.length);
            });

            it("has a sizeBytes that is positive and equals the sum of its file bytes", () => {
                const sum = entry.files.reduce((acc, f) => acc + f.bytes, 0);
                expect(entry.sizeBytes).toBeGreaterThan(0);
                // Internal consistency: the advertised footprint is exactly the download total.
                expect(entry.sizeBytes).toBe(sum);
            });
        },
    );
});

// These specs pin the catalog-merge contract the browser chooser relies on: the remote (on-chain)
// catalog is a per-id OVERLAY on the built-in default, never a wholesale replacement — so a stale or
// partial remote catalog can never shrink the chooser below the builtin floor. They also pin the
// browser-eligibility filter (one GGUF + an optional mmproj projector, ≤ 2 GB in TOTAL) that both
// ModelManager trees share.

const TWO_GB = 2_147_483_648;

const BUILTIN_IDS = defaultModelCatalog.models.map((m) => m.id);
const BUILTIN_WEB_IDS = [
    "qwen3-vl-2b-instruct-q4",
    "gemma-3-1b-it-q4",
    "qwen2.5-1.5b-instruct-q4",
    "qwen2.5-0.5b-instruct-q4",
    "smolvlm-500m-instruct-q8",
];

function entry(id: string, overrides: Partial<ModelCatalogEntry> = {}): ModelCatalogEntry {
    return {
        id,
        name: id,
        modalities: ["text"],
        runtime: "llama-cpp",
        files: [{ url: `https://host/models/${id}.gguf`, sha256: "00", bytes: 1_000_000 }],
        license: "Apache 2.0",
        sizeBytes: 1_000_000,
        ...overrides,
    };
}

// A large 2-file (model + mmproj) entry, like the gemma-4-e2b catalog entry — native-only because of
// its SIZE (4.09 GB total), which is now the only thing keeping it out of the browser chooser.
function nativeOnlyEntry(id: string): ModelCatalogEntry {
    return entry(id, {
        modalities: ["text", "image"],
        files: [
            { url: `https://host/models/${id}.gguf`, sha256: "00", bytes: 3_106_736_256 },
            { url: `https://host/models/mmproj-${id}.gguf`, sha256: "01", bytes: 985_654_080 },
        ],
        sizeBytes: 4_092_390_336,
    });
}

// A small weights+projector pair, the shape every vision model ships in.
function visionEntry(id: string, weightsBytes = 400_000_000, mmprojBytes = 100_000_000): ModelCatalogEntry {
    return entry(id, {
        modalities: ["text", "image"],
        files: [
            { url: `https://host/models/${id}.gguf`, sha256: "00", bytes: weightsBytes },
            { url: `https://host/models/mmproj-${id}.gguf`, sha256: "01", bytes: mmprojBytes },
        ],
        sizeBytes: weightsBytes + mmprojBytes,
    });
}

describe("mergeCatalogs", () => {
    it("empty remote returns the builtin catalog unchanged, in builtin order (the default first)", () => {
        const merged = mergeCatalogs([], defaultModelCatalog.models);
        expect(merged).toEqual(defaultModelCatalog.models);
        expect(merged[0].id).toBe("qwen3-vl-2b-instruct-q4");
    });

    it("a stale remote seeded with only the old gemma-4-e2b entry cannot shrink the chooser", () => {
        // The literal collapse scenario: an operator seeds ONLY the old 2-file 4.09 GB entry.
        const remote = [nativeOnlyEntry("gemma-4-e2b")];
        const merged = mergeCatalogs(remote, defaultModelCatalog.models);
        expect(merged.map((m) => m.id)).toEqual(["gemma-4-e2b", ...BUILTIN_IDS]);
        // The browser chooser still offers every builtin browser-capable model.
        expect(webEligibleModels(merged).map((m) => m.id)).toEqual(BUILTIN_WEB_IDS);
    });

    it("remote wins per-id: a same-id remote entry overrides the builtin without duplicating it", () => {
        const pinned = entry("gemma-3-1b-it-q4", {
            name: "Gemma 3 1B (pinned)",
            files: [{ url: "https://cdn.example/gemma-pinned.gguf", sha256: "ff", bytes: 806_058_240 }],
            sizeBytes: 806_058_240,
        });
        const merged = mergeCatalogs([pinned], defaultModelCatalog.models);
        expect(merged.length).toBe(defaultModelCatalog.models.length);
        const ids = merged.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
        expect(merged[0].name).toBe("Gemma 3 1B (pinned)"); // remote version, ranked first
        expect(merged[0].files[0].url).toBe("https://cdn.example/gemma-pinned.gguf");
        // Every builtin id is still present.
        for (const id of BUILTIN_IDS) {
            expect(ids).toContain(id);
        }
    });

    it("remote entries rank first, in remote order; builtin leftovers keep builtin order", () => {
        const merged = mergeCatalogs(
            [entry("z-new"), entry("a-new")],
            defaultModelCatalog.models,
        );
        expect(merged.map((m) => m.id)).toEqual(["z-new", "a-new", ...BUILTIN_IDS]);
    });

    it("duplicate ids within remote keep the first occurrence", () => {
        const merged = mergeCatalogs(
            [entry("dup", { name: "first" }), entry("dup", { name: "second" })],
            [],
        );
        expect(merged.length).toBe(1);
        expect(merged[0].name).toBe("first");
    });
});

describe("isMmprojFile / splitModelFiles", () => {
    it("classifies by the URL BASENAME, so a repo path containing 'mmproj' can't confuse it", () => {
        expect(isMmprojFile({ url: "https://h/mmproj-SmolVLM-256M.gguf", sha256: "", bytes: 1 })).toBe(true);
        expect(isMmprojFile({ url: "https://h/unsloth/mmproj-F16.gguf", sha256: "", bytes: 1 })).toBe(true);
        // "mmproj" in a directory segment must NOT make the weights look like a projector.
        expect(isMmprojFile({ url: "https://h/mmproj-repo/gemma-3-1b.gguf", sha256: "", bytes: 1 })).toBe(false);
        expect(isMmprojFile({ url: "https://h/gemma-3-1b.gguf?download=true", sha256: "", bytes: 1 })).toBe(false);
    });

    it("partitions an entry into exactly one weights file and one projector", () => {
        const { weights, mmproj } = splitModelFiles(visionEntry("v").files);
        expect(weights.map((f) => f.url)).toEqual(["https://host/models/v.gguf"]);
        expect(mmproj.map((f) => f.url)).toEqual(["https://host/models/mmproj-v.gguf"]);
    });
});

describe("webEligibleModels", () => {
    it("includes a single-file model at exactly 2 GB and excludes one a byte over", () => {
        const atLimit = entry("at-limit", {
            files: [{ url: "https://host/a.gguf", sha256: "00", bytes: TWO_GB }],
            sizeBytes: TWO_GB,
        });
        const overLimit = entry("over-limit", {
            files: [{ url: "https://host/b.gguf", sha256: "00", bytes: TWO_GB + 1 }],
            sizeBytes: TWO_GB + 1,
        });
        expect(webEligibleModels([atLimit, overLimit]).map((m) => m.id)).toEqual(["at-limit"]);
    });

    it("ACCEPTS a 2-file weights+mmproj entry — the shape every vision model ships in", () => {
        // This is the gate that used to read `files.length === 1` and so excluded every VLM in
        // existence. llama.cpp has no single-file vision GGUF, so counting files banned the feature.
        expect(webEligibleModels([visionEntry("small-multimodal")]).map((m) => m.id)).toEqual([
            "small-multimodal",
        ]);
    });

    it("budgets the TOTAL, not the per-file size: a pair whose SUM clears 2 GB is excluded", () => {
        // Each file on its own fits; together they do not. Both are resident in the SAME wasm heap,
        // so the sum is what has to fit — a per-file cap would wave this through and then OOM.
        const overBudget = visionEntry("over-budget", TWO_GB - 1000, 2000);
        expect(overBudget.files.every((f) => f.bytes <= TWO_GB)).toBe(true);
        expect(webEligibleModels([overBudget])).toEqual([]);
        expect(webEligibleModels([visionEntry("in-budget", TWO_GB - 3000, 2000)]).map((m) => m.id)).toEqual([
            "in-budget",
        ]);
    });

    it("still excludes multi-shard weights (more than one non-projector file)", () => {
        const sharded = entry("sharded", {
            files: [
                { url: "https://host/m-00001-of-00002.gguf", sha256: "00", bytes: 100 },
                { url: "https://host/m-00002-of-00002.gguf", sha256: "01", bytes: 100 },
            ],
            sizeBytes: 200,
        });
        expect(webEligibleModels([sharded])).toEqual([]);
    });

    it("still excludes the 4 GB gemma-4-e2b pair — on SIZE now, not on file count", () => {
        expect(webEligibleModels([nativeOnlyEntry("gemma-4-e2b")])).toEqual([]);
    });

    it("the builtin catalog offers the browser both text models and vision models", () => {
        const web = webEligibleModels(defaultModelCatalog.models);
        expect(web.map((m) => m.id)).toEqual(BUILTIN_WEB_IDS);
        expect(web.filter((m) => m.modalities.includes("image")).map((m) => m.id)).toEqual([
            "qwen3-vl-2b-instruct-q4",
            "smolvlm-500m-instruct-q8",
        ]);
    });

    it("the DEFAULT (index 0) is image-capable, so a new browser user can propose on a photo", () => {
        // Index 0 is what both ModelManager trees render as "Download & use (default)". Pinning the
        // MODALITY rather than the id: which model wins is a product call that will change again,
        // but a default that silently cannot read images is the regression this whole change fixed.
        const web = webEligibleModels(defaultModelCatalog.models);
        expect(web[0].id).toBe("qwen3-vl-2b-instruct-q4");
        expect(web[0].modalities).toContain("image");
        expect(web[0].sizeBytes).toBeLessThanOrEqual(WEB_MODEL_MAX_BYTES);
    });

    it("a remote seeded with only native-size multi-file models still leaves the builtin browser models", () => {
        // Worse than the report: remote would yield ZERO browser choices on its own.
        const remote = [nativeOnlyEntry("big-a"), nativeOnlyEntry("big-b")];
        const merged = mergeCatalogs(remote, defaultModelCatalog.models);
        expect(webEligibleModels(merged).map((m) => m.id)).toEqual(BUILTIN_WEB_IDS);
    });
});

describe("builtin vision entries", () => {
    it("every image-capable browser entry carries exactly one mmproj and a sha256 per file", () => {
        const vision = webEligibleModels(defaultModelCatalog.models).filter((m) =>
            m.modalities.includes("image"),
        );
        expect(vision.length).toBeGreaterThan(0);
        for (const m of vision) {
            const { weights, mmproj } = splitModelFiles(m.files);
            expect(weights.length).toBe(1);
            expect(mmproj.length).toBe(1);
            // sizeBytes is the download budget the progress bar and the ceiling both use — it must be
            // the real sum, not just the weights.
            expect(m.sizeBytes).toBe(m.files.reduce((acc, f) => acc + f.bytes, 0));
            for (const f of m.files) {
                expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
            }
        }
    });
});
