import type { BlobReference, OpenChat } from "@client";

export type LoadedMedia = {
    url: string;
    mimeType: string;
    size: number;
    // Set by the viewer when the browser fails to decode the file. The bytes were fetched (and,
    // for vault media, the view logged), but the reviewer could not actually watch it
    unplayable: boolean;
};

// The file currently being fetched (1-based) and the bytes received of it so far. `total` is
// undefined when the size isn't known ahead of the fetch (live media)
export type FetchProgress = {
    file: number;
    files: number;
    received: number;
    total: number | undefined;
};

export type ReviewStage =
    | "interstitial"
    | "loading"
    | "view"
    | "not_authorized"
    | "not_found"
    | "error";

// The terminal outcome reported when the viewer closes: "viewed" completes the
// review-before-verdict gate; "unplayable" completes it with an advisory (every file was
// fetched but the browser could not play at least one); "not_found" also completes it (the
// media genuinely no longer exists, eg. removed before quarantine, so there is nothing to
// review); "not_authorized" means the caller is not a designated vault reviewer; "error" is a
// transient fetch failure and does NOT complete the gate - the reviewer should retry
export type ReviewOutcome = "viewed" | "unplayable" | "not_authorized" | "not_found" | "error";

type VaultClient = Pick<OpenChat, "vaultFileChunk" | "vaultFileInfo" | "reportedMediaUrl">;

// The single review state machine shared by the desktop and mobile media viewers, so that the
// two are equivalent by construction and only their markup differs.
//
// Nothing is fetched until the reviewer passes the interstitial. Quarantined media is served
// through the vault (reviewer-gated; chunk 0 of each fetch is the logged review act, later
// chunks are session-ordered); non-quarantined media (an escalated report whose content is
// still live) is fetched from its ordinary blob url with no-store. Media is assembled into
// object URLs which are revoked on disposal and never written to any cache.
//
// Vault files are fetched smallest first and each is shown as soon as it has loaded, so a
// thumbnail appears while a large video is still arriving; the review only completes once
// every file has been fetched.
export class VaultMediaReview {
    stage = $state<ReviewStage>("interstitial");
    items = $state<LoadedMedia[]>([]);
    progress = $state<FetchProgress | undefined>(undefined);
    // Disposal mid-fetch must stop pulling the material: checked after every await, and any
    // object URLs already created are revoked immediately
    #cancelled = false;
    #outcome: ReviewOutcome | undefined = undefined;
    #notified = false;

    #client: VaultClient;
    #blobReferences: BlobReference[];
    #quarantined: boolean;
    #onResult: ((outcome: ReviewOutcome) => void) | undefined;

    constructor(
        client: VaultClient,
        blobReferences: BlobReference[],
        quarantined: boolean,
        onResult?: (outcome: ReviewOutcome) => void,
    ) {
        this.#client = client;
        this.#blobReferences = blobReferences;
        this.#quarantined = quarantined;
        this.#onResult = onResult;
    }

    #setReceived(received: number, total: number | undefined) {
        if (this.progress !== undefined) {
            this.progress = { ...this.progress, received, total };
        }
    }

    async #fetchDirect(ref: BlobReference): Promise<LoadedMedia | "error" | "not_found"> {
        const resp = await fetch(this.#client.reportedMediaUrl(ref), { cache: "no-store" });
        // 404: the blob no longer exists - permanently gone. Anything else (including 403,
        // which can come from a boundary node or proxy, not just deletion) is transient and
        // must NOT complete the review gate
        if (resp.status === 404) return "not_found";
        if (!resp.ok) return "error";
        const bytes = await resp.arrayBuffer();
        this.#setReceived(bytes.byteLength, bytes.byteLength);
        const mimeType = resp.headers.get("content-type") ?? "application/octet-stream";
        return {
            url: URL.createObjectURL(new Blob([bytes], { type: mimeType })),
            mimeType,
            size: bytes.byteLength,
            unplayable: false,
        };
    }

    // Chunks are requested one at a time and in order: the vault serves chunk n only after
    // chunk n-1 in the same session, and refuses anything else with SessionRequired
    async #fetchVault(
        ref: BlobReference,
    ): Promise<LoadedMedia | "error" | "not_authorized" | "not_found"> {
        const chunks: Uint8Array[] = [];
        let mimeType = "application/octet-stream";
        let chunkIndex = 0;
        let chunkCount = 1;
        let received = 0;
        while (chunkIndex < chunkCount) {
            const resp = await this.#client.vaultFileChunk(ref.canisterId, ref.blobId, chunkIndex);
            if (this.#cancelled) return "error";
            if (resp.kind === "not_authorized") return "not_authorized";
            if (resp.kind === "not_found") return "not_found";
            if (resp.kind !== "success") return "error";
            chunks.push(resp.bytes);
            received += resp.bytes.length;
            this.#setReceived(received, Number(resp.totalSize));
            mimeType = resp.mimeType;
            chunkCount = resp.chunkCount;
            chunkIndex++;
        }
        return {
            url: URL.createObjectURL(new Blob(chunks as BlobPart[], { type: mimeType })),
            mimeType,
            size: received,
            unplayable: false,
        };
    }

    // Vault file sizes come from vault_file_info (a reviewer-gated query that is not logged).
    // A size that can't be read only affects the order: that file goes last, and its chunk
    // fetch reports whatever is wrong with it
    async #smallestFirst(): Promise<{ ref: BlobReference; size: number | undefined }[]> {
        const sized = await Promise.all(
            this.#blobReferences.map(async (ref) => {
                try {
                    const info = await this.#client.vaultFileInfo(ref.canisterId, ref.blobId);
                    return { ref, size: info.kind === "success" ? Number(info.size) : undefined };
                } catch {
                    return { ref, size: undefined };
                }
            }),
        );
        return sized.sort((a, b) => (a.size ?? Infinity) - (b.size ?? Infinity));
    }

    #revokeItems() {
        this.items.forEach((item) => URL.revokeObjectURL(item.url));
        this.items = [];
    }

    async fetchAll(): Promise<void> {
        this.stage = "loading";
        const abort = (stage?: ReviewStage) => {
            this.#revokeItems();
            this.progress = undefined;
            if (stage !== undefined && !this.#cancelled) {
                this.stage = stage;
            }
        };
        let anyMissing = false;
        try {
            const queue = this.#quarantined
                ? await this.#smallestFirst()
                : this.#blobReferences.map((ref) => ({ ref, size: undefined }));
            if (this.#cancelled) return abort();
            for (const [i, { ref, size }] of queue.entries()) {
                this.progress = { file: i + 1, files: queue.length, received: 0, total: size };
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
                this.items.push(item);
            }
        } catch {
            this.#outcome = "error";
            return abort("error");
        }
        this.progress = undefined;
        if (this.items.length === 0) {
            this.#outcome = anyMissing ? "not_found" : "viewed";
            this.stage = anyMissing ? "not_found" : "view";
            return;
        }
        this.stage = "view";
        this.#outcome = "viewed";
    }

    // Called by the viewer when a media element fails to decode the file
    markUnplayable(index: number): void {
        const item = this.items[index];
        if (item !== undefined) {
            item.unplayable = true;
        }
    }

    dispose(): void {
        this.#cancelled = true;
        // Read before the items are revoked and cleared below
        const anyUnplayable = this.items.some((item) => item.unplayable);
        this.#revokeItems();
        // The outcome only counts once the viewer is closed: notifying at load time would
        // reveal the verdict actions behind the still-open viewer
        if (this.#outcome !== undefined && !this.#notified) {
            this.#notified = true;
            this.#onResult?.(
                this.#outcome === "viewed" && anyUnplayable ? "unplayable" : this.#outcome,
            );
        }
    }
}

// The review-before-verdict gate on a moderation report card, driven by the outcome the viewer
// reports when it closes. Shared by the desktop and mobile cards
export class MediaReviewGate {
    reviewed = $state(false);
    reviewerRequired = $state(false);
    fetchFailed = $state(false);
    // Advisories shown beside the verdict actions when the gate opened without a full review
    unavailable = $state(false);
    unplayable = $state(false);

    apply(outcome: ReviewOutcome): void {
        if (outcome === "viewed") {
            this.reviewed = true;
        } else if (outcome === "unplayable") {
            // Everything was fetched (and logged), so the review requirement is satisfied, but
            // the moderator is told that some of it could not be watched
            this.unplayable = true;
            this.reviewed = true;
        } else if (outcome === "not_authorized") {
            this.reviewerRequired = true;
        } else if (outcome === "not_found") {
            // The media genuinely no longer exists, so the review requirement is satisfied
            // with an advisory note; a transient fetch failure keeps the gate shut instead
            this.unavailable = true;
            this.reviewed = true;
        } else {
            this.fetchFailed = true;
        }
    }
}
