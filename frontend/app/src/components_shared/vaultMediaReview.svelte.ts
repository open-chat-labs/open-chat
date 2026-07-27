import type { BlobReference, OpenChat } from "@client";

export type LoadedMedia = {
    url: string;
    mimeType: string;
};

export type ReviewStage = "interstitial" | "loading" | "view" | "not_authorized" | "error";

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
    revealed = $state<boolean[]>([]);
    // Disposal mid-fetch must stop pulling the material: checked after every await, and any
    // object URLs already created are revoked immediately
    #cancelled = false;
    #viewed = false;
    #notified = false;

    #client: OpenChat;
    #blobReferences: BlobReference[];
    #quarantined: boolean;
    #onReviewed: (() => void) | undefined;

    constructor(
        client: OpenChat,
        blobReferences: BlobReference[],
        quarantined: boolean,
        onReviewed?: () => void,
    ) {
        this.#client = client;
        this.#blobReferences = blobReferences;
        this.#quarantined = quarantined;
        this.#onReviewed = onReviewed;
    }

    async #fetchDirect(ref: BlobReference): Promise<LoadedMedia | "error"> {
        const resp = await fetch(this.#client.reportedMediaUrl(ref), { cache: "no-store" });
        if (!resp.ok) return "error";
        const bytes = await resp.arrayBuffer();
        const mimeType = resp.headers.get("content-type") ?? "application/octet-stream";
        return { url: URL.createObjectURL(new Blob([bytes], { type: mimeType })), mimeType };
    }

    async #fetchVault(ref: BlobReference): Promise<LoadedMedia | "error" | "not_authorized"> {
        const chunks: Uint8Array[] = [];
        let mimeType = "application/octet-stream";
        let chunkIndex = 0;
        let chunkCount = 1;
        while (chunkIndex < chunkCount) {
            const resp = await this.#client.vaultFileChunk(ref.canisterId, ref.blobId, chunkIndex);
            if (this.#cancelled) return "error";
            if (resp.kind === "not_authorized") return "not_authorized";
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
        try {
            for (const ref of this.#blobReferences) {
                const item = this.#quarantined
                    ? await this.#fetchVault(ref)
                    : await this.#fetchDirect(ref);
                if (this.#cancelled) {
                    if (typeof item === "object") URL.revokeObjectURL(item.url);
                    return abort();
                }
                if (item === "not_authorized") return abort("not_authorized");
                if (item === "error") return abort("error");
                loaded.push(item);
            }
        } catch {
            return abort("error");
        }
        this.items = loaded;
        this.revealed = loaded.map(() => false);
        this.stage = "view";
        this.#viewed = true;
    }

    reveal(index: number): void {
        this.revealed[index] = true;
    }

    dispose(): void {
        this.#cancelled = true;
        this.items.forEach((item) => URL.revokeObjectURL(item.url));
        this.items = [];
        // The review only counts once the viewer is closed: notifying at load time would
        // reveal the verdict actions behind the still-open viewer
        if (this.#viewed && !this.#notified) {
            this.#notified = true;
            this.#onReviewed?.();
        }
    }
}
