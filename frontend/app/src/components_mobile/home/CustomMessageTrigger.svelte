<script lang="ts">
    import { getContext } from "svelte";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import {
        disableCreatePrizeFeature,
        disableP2PSwapFeature,
        disableSendCryptoFeature,
    } from "@src/utils/features";
    import { Body, ColourVars, Column, Row, Subtitle } from "component-lib";
    import {
        i18nKey,
        publish,
        type AttachmentContent,
        type MessageContext,
        type MessagePermission,
        type OpenChat,
    } from "openchat-client";
    import {
        loadRecentMedia,
        type MediaPermissionStatus,
        type RecentMedia,
    } from "tauri-plugin-oc-api";
    import ChartBoxOutline from "svelte-material-icons/ChartBoxOutline.svelte";
    import FileOutline from "svelte-material-icons/FileOutline.svelte";
    import GiftOutline from "svelte-material-icons/GiftOutline.svelte";
    import ImageMultipleOutline from "svelte-material-icons/ImageMultipleOutline.svelte";
    import SwapHorizontal from "svelte-material-icons/SwapHorizontal.svelte";
    import FileImageOutline from "svelte-material-icons/FileImageOutline.svelte";
    import FileVideoOutline from "svelte-material-icons/FileVideoOutline.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import MemeFighter from "../icons/MemeFighter.svelte";
    import FileAttacher from "./FileAttacher.svelte";
    import Translatable from "../Translatable.svelte";
    import ShieldAlertOutline from "svelte-material-icons/ShieldAlertOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        open: boolean;
        permittedMessages: Map<MessagePermission, boolean>;
        onClearAttachment: () => void;
        onTokenTransfer: (args: { ledger?: string; amount?: bigint }) => void;
        onCreatePrizeMessage?: () => void;
        onCreateP2PSwapMessage: () => void;
        onMakeMeme: () => void;
        onFileSelected: (content: AttachmentContent) => void;
        messageContext: MessageContext;
    }

    let {
        permittedMessages,
        open = $bindable(),
        onTokenTransfer,
        onFileSelected,
        onCreatePrizeMessage,
        onCreateP2PSwapMessage,
        onMakeMeme,
        messageContext,
    }: Props = $props();

    let mediaPermission = $state<MediaPermissionStatus>("prompt");
    let media = $state<RecentMedia[]>([]);

    $effect(() => {
        if (open && client.isNativeAndroid()) {
            loadRecentMedia().then((res: any) => {
                console.log("Media response", res);
                mediaPermission = res.permission;
                media = res.media;
            });
        }
    });

    let mediaPermitted = $derived(
        permittedMessages.get("audio") ||
            permittedMessages.get("video") ||
            permittedMessages.get("image"),
    );

    function onMediaSelected(media: RecentMedia) {
        constructFileObject(media).then((file) => {
            client
                .messageContentFromFile(file)
                .then((content) => {
                    onFileSelected(content);
                })
                .catch((err) => {
                    toastStore.showFailureToast(i18nKey(err));
                });
        });
    }

    async function constructFileObject(media: RecentMedia): Promise<File> {
        const { filePath, filename, mimeType } = media;
        const assetUrl: string = convertFileSrc(filePath);

        try {
            const response: Response = await fetch(assetUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch asset: ${response.statusText}`);
            }

            const blob: Blob = await response.blob();
            return new File([blob], filename, { type: mimeType });
        } catch (error: any) {
            // TODO i18n
            toastStore.showFailureToast(i18nKey(error.toString()));
            console.error("Error reconstructing File object:", error);
            throw error;
        }
    }
</script>

{#snippet mediaPlaceholder()}
    <div class="media-placeholder"></div>
{/snippet}

<!-- Message attachment options -->
{#snippet attachOption(key: string, Icon: any, color: string, onclick: () => void)}
    <button class="attach-option" {onclick}>
        <Column gap="sm" crossAxisAlignment="center">
            <Icon size="1.5rem" {color} />
            <Body colour="textPrimary" fontWeight="semi-bold">
                <Translatable resourceKey={i18nKey(key)} />
            </Body>
        </Column>
    </button>
{/snippet}

<div class="attachments">
    {#if mediaPermission === "denied" || (mediaPermission === "granted" && media.length === 0)}
        <Column padding={["zero", "lg"]}>
            <Row
                gap="lg"
                padding={["sm", "lg"]}
                borderRadius="md"
                mainAxisAlignment="center"
                crossAxisAlignment="center"
                backgroundColor={ColourVars.background0}>
                {#if mediaPermission === "denied"}
                    <!-- TODO wire this in, open settings for user to allow permissions -->
                    <ShieldAlertOutline size="1.75rem" color={ColourVars.warning} />
                    <Column gap="xxs">
                        <Subtitle colour="warning">
                            <Translatable resourceKey={i18nKey("Media permission not granted")} />
                        </Subtitle>
                        <Body colour="textSecondary">
                            <Translatable resourceKey={i18nKey("Tap here to provide permission")} />
                        </Body>
                    </Column>
                    <ChevronRight size="1.25rem" color={ColourVars.textSecondary} />
                {:else}
                    <Subtitle colour="textTertiary" width="hug">
                        <Translatable resourceKey={i18nKey("No media available")} />
                    </Subtitle>
                {/if}
            </Row>
        </Column>
    {:else}
        <Row width="fill" overflow="auto">
            <Row gap="sm" width="hug" padding={["zero", "zero"]}>
                {#if mediaPermission === "granted"}
                    {#each media as m}
                        <button
                            class="media-preview"
                            style:background-image={`url(${
                                m.thumbnail ?? convertFileSrc(m.filePath)
                            })`}
                            title={m.filename}
                            onclick={() => onMediaSelected(m)}>
                            <div class="media-type">
                                {#if m.mimeType.startsWith("image")}
                                    <FileImageOutline size="1rem" color={ColourVars.textPrimary} />
                                {:else}
                                    <FileVideoOutline size="1rem" color={ColourVars.textPrimary} />
                                {/if}
                            </div>
                        </button>
                    {/each}
                {:else}
                    {#each Array(10) as _}
                        {@render mediaPlaceholder()}
                    {/each}
                {/if}
            </Row>
        </Row>
    {/if}

    <div class="attach-wrapper">
        <div class="attach-buttons">
            <!-- Open Gallery -->
            {#if mediaPermitted}
                <FileAttacher {onFileSelected}>
                    {#snippet children(onClick)}
                        {@render attachOption(
                            "Open Gallery",
                            ImageMultipleOutline,
                            ColourVars.textSecondary,
                            onClick,
                        )}
                    {/snippet}
                </FileAttacher>
            {/if}

            <!-- Send File -->
            {#if permittedMessages.get("file")}
                <FileAttacher {onFileSelected}>
                    {#snippet children(onClick)}
                        {@render attachOption(
                            "Send File",
                            FileOutline,
                            ColourVars.textSecondary,
                            onClick,
                        )}
                    {/snippet}
                </FileAttacher>
            {/if}

            <!-- Create Poll -->
            {#if permittedMessages.get("poll")}
                {@render attachOption(
                    "Create Poll",
                    ChartBoxOutline,
                    ColourVars.textSecondary,
                    () => publish("createPoll", messageContext),
                )}
            {/if}

            <!-- Send Crypto -->
            {#if permittedMessages.get("crypto") && !disableSendCryptoFeature}
                {@render attachOption("Send Crypto", Bitcoin, ColourVars.textSecondary, () =>
                    onTokenTransfer({}),
                )}
            {/if}

            <!-- Offer P2P Swap -->
            {#if permittedMessages.get("p2pSwap") && !disableP2PSwapFeature}
                {@render attachOption(
                    "Offer Swap",
                    SwapHorizontal,
                    ColourVars.textSecondary,
                    onCreateP2PSwapMessage,
                )}
            {/if}

            <!-- Create Prize -->
            {#if permittedMessages.get("prize") && !disableCreatePrizeFeature}
                {@render attachOption("Create Prize", GiftOutline, ColourVars.textSecondary, () =>
                    onCreatePrizeMessage?.(),
                )}
            {/if}

            <!-- Meme fighter -->
            {#if permittedMessages.get("memeFighter")}
                {@render attachOption(
                    "Meme Fighter",
                    MemeFighter,
                    ColourVars.textSecondary,
                    onMakeMeme,
                )}
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    .attachments {
        height: 100%;
        display: flex;
        gap: var(--sp-xs);
        flex-direction: column;
        overflow: auto;
        animation: fade-in 400ms ease-out forwards;

        .media-preview,
        .media-placeholder {
            width: 8rem;
            height: 8rem;
            border: none;
            border-radius: 0 0 var(--rad-md) var(--rad-md);
            background-color: var(--background-0);
        }

        .media-preview {
            position: relative;
            background-size: cover;
            background-position: center;
            image-rendering: pixelated;

            .media-type {
                position: absolute;
                right: var(--sp-xs);
                bottom: var(--sp-xs);
            }
        }

        .attach-wrapper {
            display: flex;
            flex-direction: column;
            width: 100%;
        }

        .attach-buttons {
            display: grid;
            width: 100%;
            padding: var(--sp-xl) var(--sp-xl);
            gap: var(--sp-xl) var(--sp-xl);
            grid-template-columns: repeat(3, 1fr);
        }

        .attach-option {
            background-color: transparent;
            border: none;
            padding: 0;
            margin: 0;
        }
    }
</style>
