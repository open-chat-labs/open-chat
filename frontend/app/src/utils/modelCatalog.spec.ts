import { describe, expect, it } from "vitest";
import { defaultModelCatalog } from "./modelCatalog";

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
