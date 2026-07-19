import { describe, expect, it } from "vitest";
import {
    assessSuitability,
    hasBlocker,
    type DeviceResources,
    type SuitabilityInput,
    type UrlProbe,
} from "./modelSuitability";

// These specs pin the suitability heuristic that gates the "add a model from a URL" flow. A `blocker`
// hides Add & Download; a `caution` is advisory. The thresholds here are the contract the UI relies on.

const GiB = 1024 ** 3;

const AMPLE: DeviceResources = {
    freeDiskBytes: 500 * GiB,
    totalRamBytes: 64 * GiB,
    availableRamBytes: 48 * GiB,
    cpuCount: 8,
};

// A good direct .gguf, probed successfully.
function okProbe(bytes: number, overrides: Partial<UrlProbe> = {}): UrlProbe {
    return { ok: true, contentLength: bytes, contentType: "application/octet-stream", ...overrides };
}

function codes(input: SuitabilityInput): string[] {
    return assessSuitability(input).map((w) => w.code);
}

function blockers(input: SuitabilityInput): string[] {
    return assessSuitability(input)
        .filter((w) => w.level === "blocker")
        .map((w) => w.code);
}

describe("assessSuitability", () => {
    it("a clean small https .gguf with an mmproj and ample resources has no blockers", () => {
        const input: SuitabilityInput = {
            url: "https://host/models/model-Q4_K_M.gguf",
            mmprojUrl: "https://host/models/mmproj-F16.gguf",
            probe: okProbe(1.5 * GiB),
            mmprojProbe: okProbe(0.5 * GiB),
            resources: AMPLE,
        };
        const result = assessSuitability(input);
        expect(hasBlocker(result)).toBe(false);
        const c = result.map((w) => w.code);
        expect(c).toContain("perf-small");
        expect(c).toContain("trust");
        // mmproj was provided, so it's not flagged text-only, and the format is fine.
        expect(c).not.toContain("text-only");
        expect(c).not.toContain("not-gguf");
    });

    it("always emits the trust caution", () => {
        expect(codes({ url: "https://host/m.gguf", probe: okProbe(GiB), resources: AMPLE })).toContain(
            "trust",
        );
    });

    it("blocks a non-https URL", () => {
        expect(blockers({ url: "http://host/m.gguf", probe: okProbe(GiB), resources: AMPLE })).toContain(
            "not-https",
        );
    });

    it("blocks a URL that isn't a .gguf file", () => {
        expect(
            blockers({
                url: "https://huggingface.co/org/repo",
                probe: okProbe(GiB, { filename: "repo" }),
                resources: AMPLE,
            }),
        ).toContain("not-gguf");
    });

    it("accepts a non-.gguf URL when the resolved filename is a .gguf (signed/redirected link)", () => {
        expect(
            blockers({
                url: "https://cdn.host/download?id=abc123",
                probe: okProbe(GiB, { filename: "model-Q4_K_M.gguf" }),
                resources: AMPLE,
            }),
        ).not.toContain("not-gguf");
    });

    it("ignores query strings when checking the .gguf extension", () => {
        expect(
            blockers({
                url: "https://host/model.gguf?download=true",
                probe: okProbe(GiB),
                resources: AMPLE,
            }),
        ).not.toContain("not-gguf");
    });

    it("blocks when the URL returns an HTML page", () => {
        expect(
            blockers({
                url: "https://host/model.gguf",
                probe: okProbe(GiB, { contentType: "text/html; charset=utf-8" }),
                resources: AMPLE,
            }),
        ).toContain("html-response");
    });

    it("flags text-only when no mmproj is given, but not when one is", () => {
        expect(codes({ url: "https://host/m.gguf", probe: okProbe(GiB), resources: AMPLE })).toContain(
            "text-only",
        );
        expect(
            codes({
                url: "https://host/m.gguf",
                mmprojUrl: "https://host/mmproj.gguf",
                probe: okProbe(GiB),
                mmprojProbe: okProbe(0.3 * GiB),
                resources: AMPLE,
            }),
        ).not.toContain("text-only");
    });

    describe("disk", () => {
        it("blocks when the download exceeds free space", () => {
            const res: DeviceResources = { ...AMPLE, freeDiskBytes: 5 * GiB };
            expect(
                blockers({ url: "https://host/m.gguf", probe: okProbe(10 * GiB), resources: res }),
            ).toContain("disk-insufficient");
        });

        it("cautions when the download would leave under 2 GB free", () => {
            const res: DeviceResources = { ...AMPLE, freeDiskBytes: 5 * GiB };
            const c = codes({ url: "https://host/m.gguf", probe: okProbe(4 * GiB), resources: res });
            expect(c).toContain("disk-tight");
            expect(c).not.toContain("disk-insufficient");
        });

        it("counts the mmproj toward the disk total", () => {
            const res: DeviceResources = { ...AMPLE, freeDiskBytes: 5 * GiB };
            // Model alone (4 GB) fits with headroom, but +2 GB mmproj pushes it over.
            expect(
                blockers({
                    url: "https://host/m.gguf",
                    mmprojUrl: "https://host/mmproj.gguf",
                    probe: okProbe(4 * GiB),
                    mmprojProbe: okProbe(2 * GiB),
                    resources: res,
                }),
            ).toContain("disk-insufficient");
        });
    });

    describe("RAM", () => {
        it("blocks when the model is larger than total RAM", () => {
            const res: DeviceResources = { ...AMPLE, totalRamBytes: 8 * GiB, freeDiskBytes: 500 * GiB };
            expect(
                blockers({ url: "https://host/m.gguf", probe: okProbe(16 * GiB), resources: res }),
            ).toContain("ram-insufficient");
        });

        it("cautions when the model uses more than 60% of RAM", () => {
            const res: DeviceResources = { ...AMPLE, totalRamBytes: 8 * GiB };
            const c = codes({ url: "https://host/m.gguf", probe: okProbe(6 * GiB), resources: res });
            expect(c).toContain("ram-tight");
            expect(c).not.toContain("ram-insufficient");
        });
    });

    describe("performance buckets", () => {
        const base = (bytes: number): SuitabilityInput => ({
            url: "https://host/m.gguf",
            probe: okProbe(bytes),
            resources: AMPLE,
        });
        it("small < 2 GB", () => {
            expect(codes(base(1.5 * GiB))).toContain("perf-small");
        });
        it("medium 2–5 GB", () => {
            expect(codes(base(3 * GiB))).toContain("perf-medium");
        });
        it("large > 5 GB", () => {
            expect(codes(base(6 * GiB))).toContain("perf-large");
        });
    });

    describe("probe failures", () => {
        it("cautions (not blocks) when the probe failed", () => {
            const input: SuitabilityInput = {
                url: "https://host/m.gguf",
                probe: { ok: false, error: "server returned HTTP 404" },
                resources: AMPLE,
            };
            const result = assessSuitability(input);
            expect(result.map((w) => w.code)).toContain("probe-failed");
            // With no size, disk/RAM/perf checks are skipped.
            expect(result.map((w) => w.code)).not.toContain("disk-insufficient");
            expect(result.map((w) => w.code)).not.toContain("perf-small");
        });

        it("cautions when the link hasn't been probed at all", () => {
            expect(codes({ url: "https://host/m.gguf", resources: AMPLE })).toContain("not-checked");
        });

        it("cautions (not silently skips) when the size is known but device resources are unavailable", () => {
            const c = codes({ url: "https://host/m.gguf", probe: okProbe(30 * GiB), resources: undefined });
            expect(c).toContain("resources-unknown");
            // Fit checks are skipped, so no disk/RAM verdicts, but the perf note still appears.
            expect(c).not.toContain("disk-insufficient");
            expect(c).not.toContain("ram-insufficient");
            expect(c).toContain("perf-large");
        });
    });

    it("orders blockers before cautions", () => {
        const result = assessSuitability({
            url: "http://host/repo", // not-https + not-gguf blockers
            probe: okProbe(GiB, { filename: "repo" }),
            resources: AMPLE,
        });
        const firstCaution = result.findIndex((w) => w.level === "caution");
        const lastBlocker = result.map((w) => w.level).lastIndexOf("blocker");
        expect(lastBlocker).toBeLessThan(firstCaution);
        expect(hasBlocker(result)).toBe(true);
    });

    // --- URL / vision-projector edge cases (not covered above) ---
    describe("URL + mmproj edge cases", () => {
        it("blocks an empty (whitespace-only) URL, still emits trust, and doesn't double-flag not-https/not-gguf", () => {
            const c = codes({ url: "   ", resources: AMPLE });
            expect(c).toContain("empty-url");
            expect(c).toContain("trust");
            // empty-url subsumes the format checks — they must not also fire on ""
            expect(c).not.toContain("not-https");
            expect(c).not.toContain("not-gguf");
        });

        it("blocks a non-https vision projector URL", () => {
            expect(
                blockers({
                    url: "https://host/m.gguf",
                    mmprojUrl: "http://host/mmproj.gguf",
                    probe: okProbe(GiB),
                    mmprojProbe: okProbe(0.3 * GiB),
                    resources: AMPLE,
                }),
            ).toContain("mmproj-not-https");
        });

        it("only CAUTIONS (never blocks) when the vision projector isn't a .gguf", () => {
            const result = assessSuitability({
                url: "https://host/m.gguf",
                mmprojUrl: "https://host/projector.bin",
                probe: okProbe(GiB),
                mmprojProbe: okProbe(0.3 * GiB, { filename: "projector.bin" }),
                resources: AMPLE,
            });
            const w = result.find((x) => x.code === "mmproj-not-gguf");
            expect(w).toBeDefined();
            expect(w!.level).toBe("caution");
            expect(hasBlocker(result)).toBe(false);
        });

        it("hasBlocker is false when every warning is a caution", () => {
            const result = assessSuitability({
                url: "https://host/m.gguf",
                probe: okProbe(GiB),
                resources: AMPLE,
            });
            expect(result.every((w) => w.level === "caution")).toBe(true);
            expect(hasBlocker(result)).toBe(false);
        });

        it("accumulates multiple blockers (non-https + html page) and hasBlocker is true", () => {
            const b = blockers({
                url: "http://host/model.gguf",
                probe: okProbe(GiB, { contentType: "text/html" }),
                resources: AMPLE,
            });
            expect(b).toContain("not-https");
            expect(b).toContain("html-response");
        });
    });
});
