<script lang="ts">
    import { currentUserStore } from "@client";
    import { onMount } from "svelte";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";
    import type { Theme } from "../../theme/types";
    import {
        EXTERNAL_CONTENT_SANDBOX,
        externalContentOrigin,
        isExternalContentReady,
        type ExternalContentHostMessage,
    } from "../../utils/externalContent";
    import Translatable from "../Translatable.svelte";
    import PrivatePreview from "./PrivatePreview.svelte";

    interface Props {
        externalUrl: string;
        frozen: boolean;
        privateChatPreview: boolean;
    }

    let { externalUrl, frozen, privateChatPreview }: Props = $props();

    let iframe: HTMLIFrameElement | undefined = $state();
    let connected = $state(false);
    let error = $state(false);

    onMount(() => {
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("message", onMessage);
            iframe?.removeEventListener("error", onError);
        };
    });

    function onError() {
        error = true;
    }

    function updateTheme(theme: Theme) {
        if (connected && iframe && origin !== undefined) {
            sendMessage(iframe, origin, {
                kind: "set_theme",
                theme,
            });
        }
    }

    function debug(msg: string, ...params: unknown[]): void {
        console.debug(`OPENCHAT_EXTERNAL_HOST: ${msg}`, params);
    }

    function onMessage(ev: MessageEvent) {
        if (origin !== undefined && isExternalContentReady(ev, origin)) {
            debug("External content signals its readiness");
            if (iframe) {
                // The username is the only user data shared with the frame. Usernames are
                // already public on OpenChat (visible in any public chat and searchable).
                sendMessage(iframe, origin, {
                    kind: "initialise_external_content",
                    theme: $currentTheme,
                    username: $currentUserStore.username,
                });
            }
            connected = true;
        }
    }

    function sendMessage(
        frame: HTMLIFrameElement,
        targetOrigin: string,
        msg: ExternalContentHostMessage,
    ) {
        if (frame && frame.contentWindow) {
            try {
                frame.contentWindow.postMessage(msg, targetOrigin);
            } catch (err) {
                console.log("Error sending message to iframe", err);
            }
        }
    }
    // undefined when the url is not https, in which case no iframe is rendered at all
    let origin = $derived(externalContentOrigin(externalUrl));
    let host = $derived(origin === undefined ? undefined : new URL(origin).host);
    $effect(() => {
        updateTheme($currentTheme);
    });
    $effect(() => {
        // This is just a bit of a hack to make sure we pick up when the external url changes
        if (externalUrl !== undefined) {
            error = false;
            connected = false;
        }
    });
    $effect(() => {
        if (iframe && !frozen && !privateChatPreview) {
            iframe.removeEventListener("error", onError);
            iframe.addEventListener("error", onError);
        }
    });
</script>

{#if frozen}
    <div class="error">
        <Cancel size={"2em"} color={"var(--error)"} />
        <Translatable resourceKey={i18nKey("externalContent.frozen")} />
    </div>
{:else if privateChatPreview}
    <div class="preview">
        <PrivatePreview />
    </div>
{:else if error || origin === undefined}
    <div class="error">
        <AlertCircleOutline size={"2em"} color={"var(--error)"} />
        <Translatable resourceKey={i18nKey("externalContent.error")} />
    </div>
{/if}

{#if !frozen && !privateChatPreview && origin !== undefined}
    <!-- The host is shown so the user can see where the framed content comes from -->
    <div class="external-origin">{host}</div>
    <iframe
        title="External Content"
        bind:this={iframe}
        src={externalUrl}
        sandbox={EXTERNAL_CONTENT_SANDBOX}
        referrerpolicy="no-referrer"></iframe>
{/if}

<style lang="scss">
    iframe {
        height: 100%;
        width: 100%;
    }

    .external-origin {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        text-align: center;
        padding: $sp2 $sp3;
        border-bottom: 1px solid var(--bd);
    }

    .error {
        display: flex;
        flex-direction: column;
        gap: $sp5;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        padding: 0 toRem(100);

        @include font(bold, normal, fs-140);
    }

    .preview {
        display: flex;
        flex-direction: column-reverse;
        padding: $sp3 $sp4;
        flex: auto;
    }
</style>
