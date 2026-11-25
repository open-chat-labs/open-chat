<!-- A platform moderator reviewing a moderation report's media (L6c), from its card: the old
     VaultMediaViewer's review on the shared state machine (logic/moderation's VaultMediaReview).
     Nothing is fetched until the moderator passes the warning (Review); quarantined media comes
     through the vault, each view access-logged, smallest file first, each shown as it loads, with
     the progress; closing cancels a fetch under way. The outcome goes back to the card as it
     closes (×, the backdrop, Esc, Cancel or Close), opening its verdicts once every file has been
     seen.
     TODO(design): the design has no media review; DialogShell with the old viewer's words. -->
<script lang="ts">
    import { formatFileSize, type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import { VaultMediaReview } from "@src/logic/moderation/vaultMediaReview.svelte";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "vault_media" }>> = $props();

    const client = getContext<OpenChat>("client");
    // the dialog's own value, fixed for its life
    const { blobReferences, quarantined, onResult } = dialog;
    const review = new VaultMediaReview(client, blobReferences, quarantined, onResult);

    function close() {
        review.dispose();
        onClose();
    }

    onDestroy(() => review.dispose());

    const progress = $derived.by(() => {
        const p = review.progress;
        if (p === undefined) return undefined;
        return interpolateNewUi(
            $_,
            p.total === undefined
                ? i18nKey("vaultViewer.progressUnsized", { file: p.file, files: p.files })
                : i18nKey("vaultViewer.progress", {
                      file: p.file,
                      files: p.files,
                      received: formatFileSize(p.received),
                      total: formatFileSize(p.total),
                  }),
        );
    });
</script>

<DialogShell
    title={$_(quarantined ? "vaultViewer.title" : "vaultViewer.titleLive")}
    width={640}
    height="auto"
    onClose={close}>
    <div class="viewer">
        {#if review.stage === "interstitial"}
            <p class="text">
                {$_(quarantined ? "vaultViewer.interstitial" : "vaultViewer.interstitialLive")}
            </p>
        {:else if review.stage === "not_authorized"}
            <p class="text">{$_("vaultViewer.notAuthorized")}</p>
        {:else if review.stage === "not_found"}
            <p class="text">{$_("vaultViewer.notFound")}</p>
        {:else if review.stage === "error"}
            <p class="text error">{$_("vaultViewer.error")}</p>
        {:else}
            {#each review.items as item, i (item.url)}
                <div class="item">
                    {#if item.mimeType.startsWith("image/")}
                        <img class="media" src={item.url} alt="" />
                    {:else if item.mimeType.startsWith("video/")}
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                            class="media"
                            src={item.url}
                            controls
                            preload="none"
                            onerror={() => review.markUnplayable(i)}></video>
                    {:else if item.mimeType.startsWith("audio/")}
                        <audio
                            src={item.url}
                            controls
                            preload="none"
                            onerror={() => review.markUnplayable(i)}></audio>
                    {:else}
                        <p class="text">{item.mimeType}</p>
                    {/if}
                    {#if item.unplayable}
                        <p class="text error">
                            {interpolateNewUi(
                                $_,
                                i18nKey("vaultViewer.unplayable", {
                                    mimeType: item.mimeType,
                                    size: formatFileSize(item.size),
                                }),
                            )}
                        </p>
                    {/if}
                </div>
            {/each}
            {#if review.stage === "loading"}
                <p class="text">
                    {$_(quarantined ? "vaultViewer.loading" : "vaultViewer.loadingLive")}
                </p>
                {#if progress !== undefined}
                    <p class="text">{progress}</p>
                {/if}
                <p class="text muted">{$_("vaultViewer.closeCancels")}</p>
            {/if}
        {/if}
    </div>
    <div class="actions">
        {#if review.stage === "interstitial"}
            <Button label={$_("vaultViewer.cancel")} variant="secondary" onClick={close} />
            <Button label={$_("vaultViewer.proceed")} onClick={() => void review.fetchAll()} />
        {:else}
            <Button label={$_("vaultViewer.close")} variant="secondary" onClick={close} />
        {/if}
    </div>
</DialogShell>

<style lang="scss">
    .viewer {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        margin-bottom: var(--space-16);
    }

    .item {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .text {
        margin: 0;
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);
    }

    .muted {
        font-size: var(--text-sm);
        color: var(--ink-3);
    }

    .error {
        color: var(--status-danger);
    }

    .media {
        // the column stretches its children, which breaks the aspect ratio once max-height clamps
        align-self: center;
        width: auto;
        height: auto;
        object-fit: contain;
        max-width: 100%;
        max-height: 400px;
        border-radius: var(--radius-md);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
