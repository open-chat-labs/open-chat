<script lang="ts">
    import type { BlobReference, OpenChat } from "@client";
    import { getContext, onDestroy } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blobReferences: BlobReference[];
        onClose: () => void;
    }

    let { blobReferences, onClose }: Props = $props();

    type LoadedItem = {
        url: string;
        mimeType: string;
    };

    // Nothing is fetched until the reviewer passes the interstitial: chunk 0 of each fetch is
    // the logged review act, and later chunks are served only in session order. Media is
    // assembled into object URLs which are revoked on close and never written to any cache.
    let stage: "interstitial" | "loading" | "view" | "not_authorized" | "error" = $state("interstitial");
    let items: LoadedItem[] = $state([]);
    let revealed: boolean[] = $state([]);
    // Closing mid-fetch must stop pulling quarantined material: checked after every await,
    // and any object URLs already created are revoked immediately
    let cancelled = false;

    async function fetchAll() {
        stage = "loading";
        const loaded: LoadedItem[] = [];
        try {
            for (const ref of blobReferences) {
                const chunks: Uint8Array[] = [];
                let mimeType = "application/octet-stream";
                let chunkIndex = 0;
                let chunkCount = 1;
                while (chunkIndex < chunkCount) {
                    const resp = await client.vaultFileChunk(
                        ref.canisterId,
                        ref.blobId,
                        chunkIndex,
                    );
                    if (cancelled) {
                        loaded.forEach((item) => URL.revokeObjectURL(item.url));
                        return;
                    }
                    if (resp.kind === "not_authorized") {
                        stage = "not_authorized";
                        return;
                    }
                    if (resp.kind !== "success") {
                        stage = "error";
                        return;
                    }
                    chunks.push(resp.bytes);
                    mimeType = resp.mimeType;
                    chunkCount = resp.chunkCount;
                    chunkIndex++;
                }
                const url = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: mimeType }));
                loaded.push({ url, mimeType });
            }
        } catch {
            loaded.forEach((item) => URL.revokeObjectURL(item.url));
            if (!cancelled) {
                stage = "error";
            }
            return;
        }
        items = loaded;
        revealed = items.map(() => false);
        stage = "view";
    }

    function revoke() {
        cancelled = true;
        items.forEach((item) => URL.revokeObjectURL(item.url));
        items = [];
    }

    function close() {
        revoke();
        onClose();
    }

    onDestroy(revoke);
</script>

<ModalContent onClose={close}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("vaultViewer.title")} />
    {/snippet}
    {#snippet body()}
        <div class="viewer">
            {#if stage === "interstitial"}
                <p><Translatable resourceKey={i18nKey("vaultViewer.interstitial")} /></p>
                <div class="actions">
                    <Button onClick={fetchAll}>
                        <Translatable resourceKey={i18nKey("vaultViewer.proceed")} />
                    </Button>
                    <Button secondary onClick={close}>
                        <Translatable resourceKey={i18nKey("vaultViewer.cancel")} />
                    </Button>
                </div>
            {:else if stage === "loading"}
                <p><Translatable resourceKey={i18nKey("vaultViewer.loading")} /></p>
            {:else if stage === "not_authorized"}
                <p><Translatable resourceKey={i18nKey("vaultViewer.notAuthorized")} /></p>
            {:else if stage === "error"}
                <p><Translatable resourceKey={i18nKey("vaultViewer.error")} /></p>
            {:else}
                {#each items as item, i}
                    <div class="item">
                        <div class="label">
                            <Translatable
                                resourceKey={i18nKey("vaultViewer.item", {
                                    n: `${i + 1}`,
                                    total: `${items.length}`,
                                })} />
                        </div>
                        {#if !revealed[i]}
                            <button class="shroud" onclick={() => (revealed[i] = true)}>
                                <Translatable resourceKey={i18nKey("vaultViewer.reveal")} />
                            </button>
                        {:else if item.mimeType.startsWith("image/")}
                            <img class="media" src={item.url} alt="" />
                        {:else if item.mimeType.startsWith("video/")}
                            <!-- svelte-ignore a11y_media_has_caption -->
                            <video class="media" src={item.url} controls preload="none"></video>
                        {:else if item.mimeType.startsWith("audio/")}
                            <audio src={item.url} controls preload="none"></audio>
                        {:else}
                            <p>{item.mimeType}</p>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .viewer {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
    .actions {
        display: flex;
        gap: $sp3;
    }
    .item {
        display: flex;
        flex-direction: column;
        gap: $sp2;
    }
    .label {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }
    .shroud {
        display: flex;
        align-items: center;
        justify-content: center;
        height: toRem(200);
        border-radius: toRem(8);
        border: none;
        padding: 0;
        width: 100%;
        cursor: pointer;
        background: repeating-linear-gradient(
            45deg,
            var(--button-bg),
            var(--button-bg) toRem(10),
            var(--button-hv) toRem(10),
            var(--button-hv) toRem(20)
        );
        color: var(--button-txt);
    }
    .media {
        max-width: 100%;
        max-height: toRem(400);
        // Initial render is deliberately reduced; the reviewer already chose to reveal
        filter: grayscale(1);
        &:hover,
        &:focus {
            filter: none;
        }
    }
</style>
