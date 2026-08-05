// Suitability heuristic for a user-supplied "add a model from a URL" model (PR-cat-3).
//
// PURE and side-effect free so it can be unit-tested exhaustively. Given a candidate URL (plus an optional
// vision projector), the native preflight probe of each (probe_model_url), and the device's resources
// (system_resources), it returns an ordered list of warnings. A `blocker` means "don't let them download
// this" (the UI hides Add & Download); a `caution` is advisory (shown, but download is still allowed).
//
// The thresholds are deliberately conservative — the goal is to stop obvious mistakes (a repo page instead
// of a direct file, a model that can't fit on disk or in RAM) and set expectations (large models are slow
// without a GPU), not to be a precise capability oracle.

export type SuitabilityLevel = "blocker" | "caution";

export interface SuitabilityWarning {
    level: SuitabilityLevel;
    // Stable machine code (handy for tests and for the UI to key/dedupe on).
    code: string;
    message: string;
}

// The subset of probe_model_url's response this heuristic needs.
export interface UrlProbe {
    ok: boolean;
    contentLength?: number;
    contentType?: string;
    // Best-effort filename (Content-Disposition, else URL tail) — lets a valid file whose URL lacks a
    // `.gguf` suffix (signed/redirected links) still pass the format check.
    filename?: string;
    error?: string;
}

// The subset of system_resources's response this heuristic needs.
export interface DeviceResources {
    freeDiskBytes: number;
    totalRamBytes: number;
    availableRamBytes: number;
    cpuCount: number;
}

export interface SuitabilityInput {
    // Primary model file URL (required, expected to be a direct .gguf link).
    url: string;
    // Optional vision projector (mmproj) URL — its presence makes the model multimodal.
    mmprojUrl?: string;
    // Preflight probe of the primary file (undefined if not yet probed).
    probe?: UrlProbe;
    // Preflight probe of the mmproj file (undefined if none / not probed).
    mmprojProbe?: UrlProbe;
    // Device headroom (undefined if unavailable — size checks are then skipped).
    resources?: DeviceResources;
}

const GiB = 1024 ** 3;
// A download that would leave less than this much free disk is flagged (caution), even if it technically fits.
const DISK_HEADROOM_BYTES = 2 * GiB;
// A model whose weights exceed this fraction of total RAM is flagged as tight.
const RAM_CAUTION_FRACTION = 0.6;

function trimmed(url: string | undefined): string {
    return (url ?? "").trim();
}

function isHttps(url: string): boolean {
    return /^https:\/\//i.test(url);
}

function endsInGguf(value: string): boolean {
    // Ignore any query string / fragment before checking the extension.
    const path = value.split(/[?#]/, 1)[0];
    return /\.gguf$/i.test(path);
}

// A URL "is a gguf" if its path ends in .gguf OR the server's resolved filename does (covers signed/
// redirected links whose URL carries no extension).
function looksLikeGguf(url: string, probe: UrlProbe | undefined): boolean {
    return endsInGguf(url) || (probe?.filename !== undefined && endsInGguf(probe.filename));
}

export function formatBytes(bytes: number): string {
    const gb = bytes / GiB;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${Math.round(bytes / 1024 / 1024)} MB`;
}

const LEVEL_RANK: Record<SuitabilityLevel, number> = { blocker: 0, caution: 1 };

export function assessSuitability(input: SuitabilityInput): SuitabilityWarning[] {
    const warnings: SuitabilityWarning[] = [];
    const push = (level: SuitabilityLevel, code: string, message: string) =>
        warnings.push({ level, code, message });

    const url = trimmed(input.url);

    // --- Primary URL: scheme + format ---
    if (url === "") {
        push("blocker", "empty-url", "Enter a model URL.");
    } else {
        if (!isHttps(url)) {
            push("blocker", "not-https", "The URL must use https://.");
        }
        if (!looksLikeGguf(url, input.probe)) {
            push(
                "blocker",
                "not-gguf",
                "The link must point directly at a .gguf model file (e.g. …/resolve/main/model.gguf), not a web page or a repository.",
            );
        }
    }

    // --- Optional vision projector: scheme + format ---
    const mmproj = trimmed(input.mmprojUrl);
    if (mmproj !== "") {
        if (!isHttps(mmproj)) {
            push("blocker", "mmproj-not-https", "The vision projector URL must use https://.");
        }
        if (!looksLikeGguf(mmproj, input.mmprojProbe)) {
            push(
                "caution",
                "mmproj-not-gguf",
                "The vision projector link doesn't look like a direct .gguf file — double-check it's the mmproj GGUF.",
            );
        }
    } else {
        push(
            "caution",
            "text-only",
            "No vision projector (mmproj) provided — this model will be text-only and can't process images.",
        );
    }

    // --- Content type: a web page instead of a file ---
    const contentType = (input.probe?.contentType ?? "").toLowerCase();
    if (contentType.includes("text/html")) {
        push(
            "blocker",
            "html-response",
            "This URL returns a web page, not a file. Use a direct download link — opening it should start a download, not show a page.",
        );
    }

    // --- Size known? Native downloads are strictly bounded by the declared byte count, so an
    // unknown primary/projector size cannot be represented safely and must block Add & Download. ---
    const modelBytes = input.probe?.contentLength;
    const sizeKnown = input.probe?.ok === true && modelBytes !== undefined && modelBytes > 0;

    if (input.probe === undefined) {
        push(
            "blocker",
            "not-checked",
            "Check the link before downloading so its file size can be verified and bounded.",
        );
    } else if (!sizeKnown) {
        const reason = input.probe?.error;
        push(
            "blocker",
            "probe-failed",
            reason !== undefined && reason !== ""
                ? `Couldn't verify the file (${reason}). A bounded download requires a known positive size.`
                : "Couldn't determine a positive file size. A bounded download requires it.",
        );
    } else if (input.resources === undefined) {
        // Size is known, but we couldn't read the device's storage/memory, so the fit checks below don't
        // run — say so, rather than implying (via the perf note) that the model was fully vetted.
        push(
            "caution",
            "resources-unknown",
            "Couldn't read this device's storage and memory — the disk-space and RAM-fit checks were skipped.",
        );
    }

    if (mmproj !== "") {
        const mmprojBytes = input.mmprojProbe?.contentLength;
        const mmprojSizeKnown =
            input.mmprojProbe?.ok === true && mmprojBytes !== undefined && mmprojBytes > 0;
        if (input.mmprojProbe === undefined) {
            push(
                "blocker",
                "mmproj-not-checked",
                "Check the vision projector link before downloading so its file size can be verified and bounded.",
            );
        } else if (!mmprojSizeKnown) {
            const reason = input.mmprojProbe.error;
            push(
                "blocker",
                "mmproj-probe-failed",
                reason !== undefined && reason !== ""
                    ? `Couldn't verify the vision projector (${reason}). A bounded download requires a known positive size.`
                    : "Couldn't determine a positive vision projector size. A bounded download requires it.",
            );
        }
    }

    // --- Disk: total download (model + mmproj) vs free space ---
    if (sizeKnown && modelBytes !== undefined && input.resources !== undefined) {
        const totalBytes = modelBytes + (input.mmprojProbe?.contentLength ?? 0);
        const free = input.resources.freeDiskBytes;
        if (totalBytes > free) {
            push(
                "blocker",
                "disk-insufficient",
                `Not enough free disk space: needs ${formatBytes(totalBytes)}, only ${formatBytes(free)} free.`,
            );
        } else if (totalBytes > free - DISK_HEADROOM_BYTES) {
            push(
                "caution",
                "disk-tight",
                `This download (${formatBytes(totalBytes)}) would leave under 2 GB free of ${formatBytes(free)}.`,
            );
        }
    }

    // --- RAM: the model weights must fit (mmproj also loads but is smaller — the LM file dominates) ---
    if (
        sizeKnown &&
        modelBytes !== undefined &&
        input.resources !== undefined &&
        input.resources.totalRamBytes > 0
    ) {
        const ram = input.resources.totalRamBytes;
        if (modelBytes > ram) {
            push(
                "blocker",
                "ram-insufficient",
                `The model (${formatBytes(modelBytes)}) is larger than this device's ${formatBytes(ram)} of RAM and won't load.`,
            );
        } else if (modelBytes > RAM_CAUTION_FRACTION * ram) {
            push(
                "caution",
                "ram-tight",
                `The model (${formatBytes(modelBytes)}) uses most of this device's ${formatBytes(ram)} RAM — it may run slowly or strain other apps.`,
            );
        }
    }

    // --- Performance: size bucket + CPU hint (informational) ---
    if (sizeKnown && modelBytes !== undefined) {
        const gb = modelBytes / GiB;
        const cpu = input.resources?.cpuCount;
        const cpuHint =
            cpu !== undefined && cpu > 0 ? ` on ${cpu} CPU core${cpu === 1 ? "" : "s"}` : "";
        if (gb > 5) {
            push(
                "caution",
                "perf-large",
                `Large model (${formatBytes(modelBytes)}) — expect slow responses${cpuHint} without a GPU.`,
            );
        } else if (gb >= 2) {
            push(
                "caution",
                "perf-medium",
                `Moderate size (${formatBytes(modelBytes)}) — responses may be slow${cpuHint}.`,
            );
        } else {
            push(
                "caution",
                "perf-small",
                `Small model (${formatBytes(modelBytes)}) — fast, though heavily quantized models can be lower quality.`,
            );
        }
    }

    // --- Trust: always shown for a user-provided link ---
    push(
        "caution",
        "trust",
        "You provided this link — its integrity isn't pre-verified. Only add models from sources you trust.",
    );

    // Blockers first, then cautions; stable within each level (preserves the order above).
    return warnings.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

// Convenience: does this assessment forbid downloading?
export function hasBlocker(warnings: SuitabilityWarning[]): boolean {
    return warnings.some((w) => w.level === "blocker");
}
