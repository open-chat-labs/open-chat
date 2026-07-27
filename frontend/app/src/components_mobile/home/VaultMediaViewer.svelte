<script lang="ts">
    import type { BlobReference, OpenChat } from "@client";
    import { VaultMediaReview } from "@shared_components/vaultMediaReview.svelte";
    import { Body, BodySmall, Button, Column, Sheet, Subtitle } from "component-lib";
    import { getContext, onDestroy } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
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
        {:else if review.stage === "loading"}
            <Body>
                <Translatable
                    resourceKey={i18nKey(
                        quarantined ? "vaultViewer.loading" : "vaultViewer.loadingLive",
                    )}
                />
            </Body>
        {:else if review.stage === "not_authorized"}
            <Body><Translatable resourceKey={i18nKey("vaultViewer.notAuthorized")} /></Body>
        {:else if review.stage === "error"}
            <Body><Translatable resourceKey={i18nKey("vaultViewer.error")} /></Body>
        {:else}
            {#each review.items as item, i}
                <Column gap={"sm"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey("vaultViewer.item", {
                                n: `${i + 1}`,
                                total: `${review.items.length}`,
                            })}
                        />
                    </BodySmall>
                    {#if item.mimeType.startsWith("image/")}
                        <img class="media" src={item.url} alt="" />
                    {:else if item.mimeType.startsWith("video/")}
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video class="media" src={item.url} controls preload="none"></video>
                    {:else if item.mimeType.startsWith("audio/")}
                        <audio src={item.url} controls preload="none"></audio>
                    {:else}
                        <Body>{item.mimeType}</Body>
                    {/if}
                </Column>
            {/each}
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
