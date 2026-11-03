import type { BlobReference, OpenChat } from "@client";

export type LoadedMedia = {
    url: string;
    mimeType: string;
};

export type ReviewStage = "interstitial" | "loading" | "view" | "not_authorized" | "not_found" | "error";

// The terminal outcome reported when the viewer closes: "viewed" completes the
// review-before-verdict gate; "not_found" also completes it (the media genuinely no longer
// exists, eg. removed before quarantine, so there is nothing to review); "not_authorized"
// means the caller is not a designated vault reviewer; "error" is a transient fetch failure
// and does NOT complete the gate - the reviewer should retry
export type ReviewOutcome = "viewed" | "not_authorized" | "not_found" | "error";

// The single review state machine shared by the desktop and mobile media viewers, so that the
// two are equivalent by construction and only their markup differs.
//
// Nothing is fetched until the reviewer passes the interstitial. Quarantined media is served
// through the vault (reviewer-gated; chunk 0 of each fetch is the logged review act, later
// chunks are session-ordered); non-quarantined media (an escalated report whose content is
// still live) is fetched from its ordinary blob url with no-store. Media is assembled into
// object URLs which are revoked on disposal and never written to any cache.
//
// Every request is bounded by a timeout: a call which never settles (a wedged update call, a
// stalled blob fetch) would otherwise leave the viewer on "loading" forever with the review
// gate shut and the report unresolvable. A timeout is treated as a transient "error".
export const REQUEST_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

export class VaultMediaReview {
    stage = $state<ReviewStage>("interstitial");
    items = $state<LoadedMedia[]>([]);
    // Disposal mid-fetch must stop pulling the material: checked after every await, and any
    // object URLs already created are revoked immediately
    #cancelled = false;
    // Aborts an in-flight direct fetch on disposal or timeout, so the bytes stop downloading
    #abort = new AbortController();
    #outcome: ReviewOutcome | undefined = undefined;
    #notified = false;

    #client: OpenChat;
    #blobReferences: BlobReference[];
    #quarantined: boolean;
    #onResult: ((outcome: ReviewOutcome) => void) | undefined;
    #timeoutMs: number;

    constructor(
        client: OpenChat,
        blobReferences: BlobReference[],
        quarantined: boolean,
        onResult?: (outcome: ReviewOutcome) => void,
        timeoutMs: number = REQUEST_TIMEOUT_MS,
    ) {
        this.#client = client;
        this.#blobReferences = blobReferences;
        this.#quarantined = quarantined;
        this.#onResult = onResult;
        this.#timeoutMs = timeoutMs;
    }

    async #fetchDirect(ref: BlobReference): Promise<LoadedMedia | "error" | "not_found"> {
        // One controller per fetch so a stall aborts only that fetch; disposal aborts it too.
        // The timeout is on progress, not on the whole download: a large live video on a slow
        // link must still be reviewable, so the clock restarts with every chunk received
        const controller = new AbortController();
        const onDispose = () => controller.abort();
        this.#abort.signal.addEventListener("abort", onDispose);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const touch = () => {
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), this.#timeoutMs);
        };
        try {
            touch();
            const resp = await fetch(this.#client.reportedMediaUrl(ref), {
                cache: "no-store",
                signal: controller.signal,
            });
            // 404: the blob no longer exists - permanently gone. Anything else (including 403,
            // which can come from a boundary node or proxy, not just deletion) is transient and
            // must NOT complete the review gate
            if (resp.status === 404) return "not_found";
            if (!resp.ok) return "error";
            const mimeType = resp.headers.get("content-type") ?? "application/octet-stream";
            const parts: Uint8Array[] = [];
            if (resp.body !== null) {
                const reader = resp.body.getReader();
                for (;;) {
                    touch();
                    const { done, value } = await reader.read();
                    if (done) break;
                    parts.push(value);
                }
            }
            return {
                url: URL.createObjectURL(new Blob(parts as BlobPart[], { type: mimeType })),
                mimeType,
            };
        } finally {
            clearTimeout(timer);
            this.#abort.signal.removeEventListener("abort", onDispose);
        }
    }

    async #fetchVault(ref: BlobReference): Promise<LoadedMedia | "error" | "not_authorized" | "not_found"> {
        const chunks: Uint8Array[] = [];
        let mimeType = "application/octet-stream";
        let chunkIndex = 0;
        let chunkCount = 1;
        // A timed-out chunk call still runs on the canister and can land after a retry has
        // started a new session, moving the session cursor past us. One restart from chunk 0
        // (a fresh, logged session) recovers from that rather than failing the retry too
        let restarted = false;
        while (chunkIndex < chunkCount) {
            const resp = await withTimeout(
                this.#client.vaultFileChunk(ref.canisterId, ref.blobId, chunkIndex),
                this.#timeoutMs,
            );
            if (this.#cancelled) return "error";
            if (resp.kind === "not_authorized") return "not_authorized";
            if (resp.kind === "not_found") return "not_found";
            if (resp.kind === "session_required" && chunkIndex > 0 && !restarted) {
                restarted = true;
                chunks.length = 0;
                chunkIndex = 0;
                chunkCount = 1;
                continue;
            }
            if (resp.kind !== "success") return "error";
            chunks.push(resp.bytes);
            mimeType = resp.mimeType;
            chunkCount = resp.chunkCount;
            chunkIndex++;
        }
        return {
            url: URL.createObjectURL(new Blob(chunks as BlobPart[], { type: mimeType })),
            mimeType,
        };
    }

    async fetchAll(): Promise<void> {
        this.stage = "loading";
        const loaded: LoadedMedia[] = [];
        const abort = (stage?: ReviewStage) => {
            loaded.forEach((item) => URL.revokeObjectURL(item.url));
            if (stage !== undefined && !this.#cancelled) {
                this.stage = stage;
            }
        };
        let anyMissing = false;
        try {
            for (const ref of this.#blobReferences) {
                const item = this.#quarantined
                    ? await this.#fetchVault(ref)
                    : await this.#fetchDirect(ref);
                if (this.#cancelled) {
                    if (typeof item === "object") URL.revokeObjectURL(item.url);
                    return abort();
                }
                if (item === "not_authorized") {
                    this.#outcome = "not_authorized";
                    return abort("not_authorized");
                }
                if (item === "not_found") {
                    // A missing blob must not hide the ones that still exist: keep going and
                    // report not_found only if NOTHING could be shown
                    anyMissing = true;
                    continue;
                }
                if (item === "error") {
                    this.#outcome = "error";
                    return abort("error");
                }
                loaded.push(item);
            }
        } catch {
            this.#outcome = "error";
            return abort("error");
        }
        if (loaded.length === 0) {
            this.#outcome = anyMissing ? "not_found" : "viewed";
            return abort(anyMissing ? "not_found" : "view");
        }
        this.items = loaded;
        this.stage = "view";
        this.#outcome = "viewed";
    }

    dispose(): void {
        this.#cancelled = true;
        this.#abort.abort();
        this.items.forEach((item) => URL.revokeObjectURL(item.url));
        this.items = [];
        // The outcome only counts once the viewer is closed: notifying at load time would
        // reveal the verdict actions behind the still-open viewer
        if (this.#outcome !== undefined && !this.#notified) {
            this.#notified = true;
            this.#onResult?.(this.#outcome);
        }
    }
}
