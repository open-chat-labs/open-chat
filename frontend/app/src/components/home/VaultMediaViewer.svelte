<script lang="ts">
    import type { BlobReference, OpenChat } from "@client";
    import { VaultMediaReview } from "@shared_components/vaultMediaReview.svelte";
    import { getContext, onDestroy } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { mobileWidth } from "@client";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blobReferences: BlobReference[];
        // Quarantined media is served through the vault (reviewer-gated, access-logged);
        // non-quarantined media (an escalated report whose content is still live) is fetched
        // from its ordinary blob URL with the same interstitial and no-cache hygiene
        quarantined: boolean;
        onClose: () => void;
        // Fired when the media has successfully loaded: the review act has taken place (and
        // for vault media has been recorded in the access log by the chunk fetches)
        onReviewed?: () => void;
    }

    let { blobReferences, quarantined, onClose, onReviewed }: Props = $props();

    // All review behaviour lives in the shared state machine so that the desktop and mobile
    // viewers are equivalent by construction; this component is markup only
    const review = new VaultMediaReview(client, blobReferences, quarantined, onReviewed);

    function close() {
        review.dispose();
        onClose();
    }

    onDestroy(() => review.dispose());
</script>

<Overlay onClose={close} dismissible>
    <ModalContent onClose={close}>
        {#snippet header()}
            <Translatable
                resourceKey={i18nKey(quarantined ? "vaultViewer.title" : "vaultViewer.titleLive")}
            />
        {/snippet}
        {#snippet body()}
            <div class="viewer">
                {#if review.stage === "interstitial"}
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                quarantined
                                    ? "vaultViewer.interstitial"
                                    : "vaultViewer.interstitialLive",
                            )}
                        />
                    </p>
                {:else if review.stage === "loading"}
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                quarantined ? "vaultViewer.loading" : "vaultViewer.loadingLive",
                            )}
                        />
                    </p>
                {:else if review.stage === "not_authorized"}
                    <p><Translatable resourceKey={i18nKey("vaultViewer.notAuthorized")} /></p>
                {:else if review.stage === "error"}
                    <p><Translatable resourceKey={i18nKey("vaultViewer.error")} /></p>
                {:else}
                    {#each review.items as item, i}
                        <div class="item">
                            <div class="label">
                                <Translatable
                                    resourceKey={i18nKey("vaultViewer.item", {
                                        n: `${i + 1}`,
                                        total: `${review.items.length}`,
                                    })}
                                />
                            </div>
                            {#if item.mimeType.startsWith("image/")}
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
        {#snippet footer()}
            <ButtonGroup>
                {#if review.stage === "interstitial"}
                    <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={close}>
                        <Translatable resourceKey={i18nKey("vaultViewer.cancel")} />
                    </Button>
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={() => review.fetchAll()}
                    >
                        <Translatable resourceKey={i18nKey("vaultViewer.proceed")} />
                    </Button>
                {:else}
                    <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={close}>
                        <Translatable resourceKey={i18nKey("vaultViewer.close")} />
                    </Button>
                {/if}
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .viewer {
        display: flex;
        flex-direction: column;
        gap: $sp4;
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
    .media {
        // The flex column stretches children by default, which breaks the aspect ratio once
        // max-height clamps the image
        align-self: center;
        width: auto;
        height: auto;
        object-fit: contain;
        max-width: 100%;
        max-height: toRem(400);
    }
</style>
