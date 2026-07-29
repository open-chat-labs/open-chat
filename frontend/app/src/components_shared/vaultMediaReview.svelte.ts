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
export class VaultMediaReview {
    stage = $state<ReviewStage>("interstitial");
    items = $state<LoadedMedia[]>([]);
    // Disposal mid-fetch must stop pulling the material: checked after every await, and any
    // object URLs already created are revoked immediately
    #cancelled = false;
    #outcome: ReviewOutcome | undefined = undefined;
    #notified = false;

    #client: OpenChat;
    #blobReferences: BlobReference[];
    #quarantined: boolean;
    #onResult: ((outcome: ReviewOutcome) => void) | undefined;

    constructor(
        client: OpenChat,
        blobReferences: BlobReference[],
        quarantined: boolean,
        onResult?: (outcome: ReviewOutcome) => void,
    ) {
        this.#client = client;
        this.#blobReferences = blobReferences;
        this.#quarantined = quarantined;
        this.#onResult = onResult;
    }

    async #fetchDirect(ref: BlobReference): Promise<LoadedMedia | "error" | "not_found"> {
        const resp = await fetch(this.#client.reportedMediaUrl(ref), { cache: "no-store" });
        // 404: the blob no longer exists - permanently gone. Anything else (including 403,
        // which can come from a boundary node or proxy, not just deletion) is transient and
        // must NOT complete the review gate
        if (resp.status === 404) return "not_found";
        if (!resp.ok) return "error";
        const bytes = await resp.arrayBuffer();
        const mimeType = resp.headers.get("content-type") ?? "application/octet-stream";
        return { url: URL.createObjectURL(new Blob([bytes], { type: mimeType })), mimeType };
    }

    async #fetchVault(ref: BlobReference): Promise<LoadedMedia | "error" | "not_authorized" | "not_found"> {
        const chunks: Uint8Array[] = [];
        let mimeType = "application/octet-stream";
        let chunkIndex = 0;
        let chunkCount = 1;
        while (chunkIndex < chunkCount) {
            const resp = await this.#client.vaultFileChunk(ref.canisterId, ref.blobId, chunkIndex);
            if (this.#cancelled) return "error";
            if (resp.kind === "not_authorized") return "not_authorized";
            if (resp.kind === "not_found") return "not_found";
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
