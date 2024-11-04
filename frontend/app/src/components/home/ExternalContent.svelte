<script lang="ts">
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { currentTheme } from "../../theme/themes";
    import type { Theme } from "../../theme/types";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { onMount } from "svelte";
    import PrivatePreview from "./PrivatePreview.svelte";
    import { currentUser as user } from "openchat-client";

    export let externalUrl: string;
    export let frozen: boolean;
    export let privateChatPreview: boolean;

    let iframe: HTMLIFrameElement;
    let connected = false;
    let error = false;

    $: origin = new URL(externalUrl).origin;

    $: {
        updateTheme($currentTheme);
    }

    $: {
        // This is just a bit of a hack to make sure we pick up when the external url changes
        if (externalUrl !== undefined) {
            error = false;
            connected = false;
        }
    }

    $: {
        if (iframe && !frozen && !privateChatPreview) {
            iframe.removeEventListener("error", onError);
            iframe.addEventListener("error", onError);
        }
    }

    onMount(() => {
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("message", onMessage);
            if (iframe) {
                iframe.removeEventListener("error", onError);
            }
        };
    });

    function onError() {
        error = true;
    }

    function updateTheme(theme: Theme) {
        if (connected) {
            sendMessage(iframe, origin, {
                kind: "set_theme",
                theme,
            });
        }
    }

    function debug(msg: string, ...params: unknown[]): void {
        console.debug(`OPENCHAT_EXTERNAL_HOST: ${msg}`, params);
    }

    function onMessage(ev: MessageEvent<{ kind: "external_content_ready" }>) {
        if (ev.origin === origin && ev.data.kind === "external_content_ready") {
            debug("External content signals its readiness");
            sendMessage(iframe, origin, {
                kind: "initialise_external_content",
                theme: $currentTheme,
                username: $user.username,
            });
            connected = true;
        }
    }

    function sendMessage(frame: HTMLIFrameElement, targetOrigin: string, msg: unknown) {
        if (frame && frame.contentWindow) {
            try {
                frame.contentWindow.postMessage(msg, targetOrigin);
            } catch (err) {
                console.log("Error sending message to iframe", err);
            }
        }
    }
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
{:else if error}
    <div class="error">
        <AlertCircleOutline size={"2em"} color={"var(--error)"} />
        <Translatable resourceKey={i18nKey("externalContent.error")} />
    </div>
{/if}

{#if !frozen && !privateChatPreview}
    <iframe title="External Content" bind:this={iframe} src={externalUrl} />
{/if}

<style lang="scss">
    iframe {
        height: 100%;
        width: 100%;
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
