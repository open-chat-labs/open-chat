<script lang="ts">
    import { formatFileSize, type BlobReference, type OpenChat } from "@client";
    import {
        VaultMediaReview,
        type ReviewOutcome,
    } from "@src/logic/moderation/vaultMediaReview.svelte";
    import { Body, Button, Column, Sheet, Subtitle } from "component-lib";
    import { getContext, onDestroy } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blobReferences: BlobReference[];
        // Quarantined media is served through the vault (reviewer-gated, access-logged);
        // non-quarantined media (an escalated report whose content is still live) is fetched
        // from its ordinary blob URL with the same interstitial and no-cache hygiene
        quarantined: boolean;
        onClose: () => void;
        // Fired when the viewer closes with the terminal outcome: "viewed" (the review act
        // took place - for vault media it is in the access log), "not_found" (the media no
        // longer exists), "not_authorized" (not a designated vault reviewer) or "error"
        // (transient fetch failure - the review gate stays shut)
        onResult?: (outcome: ReviewOutcome) => void;
    }

    let { blobReferences, quarantined, onClose, onResult }: Props = $props();

    // All review behaviour lives in the shared state machine so that the desktop and mobile
    // viewers are equivalent by construction; this component is markup only
    const review = new VaultMediaReview(client, blobReferences, quarantined, onResult);

    function close() {
        review.dispose();
        onClose();
    }

    onDestroy(() => review.dispose());
</script>

<Sheet onDismiss={close}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable
                resourceKey={i18nKey(quarantined ? "vaultViewer.title" : "vaultViewer.titleLive")}
            />
        </Subtitle>
        {#if review.stage === "interstitial"}
            <Body>
                <Translatable
                    resourceKey={i18nKey(
                        quarantined ? "vaultViewer.interstitial" : "vaultViewer.interstitialLive",
                    )}
                />
            </Body>
            <Column gap={"sm"}>
                <Button onClick={() => review.fetchAll()}>
                    <Translatable resourceKey={i18nKey("vaultViewer.proceed")} />
                </Button>
                <Button secondary onClick={close}>
                    <Translatable resourceKey={i18nKey("vaultViewer.cancel")} />
                </Button>
            </Column>
        {:else if review.stage === "not_authorized"}
            <Body><Translatable resourceKey={i18nKey("vaultViewer.notAuthorized")} /></Body>
        {:else if review.stage === "not_found"}
            <Body><Translatable resourceKey={i18nKey("vaultViewer.notFound")} /></Body>
        {:else if review.stage === "error"}
            <Body><Translatable resourceKey={i18nKey("vaultViewer.error")} /></Body>
        {:else}
            {#each review.items as item, i}
                <Column gap={"sm"}>
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
                        <Body>{item.mimeType}</Body>
                    {/if}
                    {#if item.unplayable}
                        <Body colour="validationError">
                            <Translatable
                                resourceKey={i18nKey("vaultViewer.unplayable", {
                                    mimeType: item.mimeType,
                                    size: formatFileSize(item.size),
                                })}
                            />
                        </Body>
                    {/if}
                </Column>
            {/each}
            {#if review.stage === "loading"}
                <Body>
                    <Translatable
                        resourceKey={i18nKey(
                            quarantined ? "vaultViewer.loading" : "vaultViewer.loadingLive",
                        )}
                    />
                </Body>
                {#if review.progress !== undefined}
                    <Body>
                        <Translatable
                            resourceKey={review.progress.total === undefined
                                ? i18nKey("vaultViewer.progressUnsized", {
                                      file: review.progress.file,
                                      files: review.progress.files,
                                  })
                                : i18nKey("vaultViewer.progress", {
                                      file: review.progress.file,
                                      files: review.progress.files,
                                      received: formatFileSize(review.progress.received),
                                      total: formatFileSize(review.progress.total),
                                  })}
                        />
                    </Body>
                {/if}
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("vaultViewer.closeCancels")} />
                </Body>
            {/if}
        {/if}
        {#if review.stage !== "interstitial"}
            <Button secondary onClick={close}>
                <Translatable resourceKey={i18nKey("vaultViewer.close")} />
            </Button>
        {/if}
    </Column>
</Sheet>

<style lang="scss">
    .media {
        // The flex column stretches children by default, which breaks the aspect ratio once
        // max-height clamps the image
        align-self: center;
        width: auto;
        height: auto;
        object-fit: contain;
        max-width: 100%;
        max-height: 25rem;
    }
</style>
