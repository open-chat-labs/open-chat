<script lang="ts">
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { currentTheme } from "../../theme/themes";
    import type { Theme } from "../../theme/types";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    type OpenChatXFrame = {};

    const TIMEOUT_ITERATIONS = 5;
    const client = getContext<OpenChat>("client");

    export let externalUrl: string;
    export let frozen: boolean;

    let ready = false;
    let error = false;

    $: origin = new URL(externalUrl).origin;
    $: user = client.user;

    $: {
        updateTheme($currentTheme);
    }

    $: {
        error = false;
        ready = false;
        // this is going to react *only* if the url changes. You could strictly speaking have two
        // chats with the same externalUrl, but it begs the question why would you and why would it matter?
        waitUntilReady(externalUrl);
    }

    function waitUntilReady(url: string, iterations: number = 0, defer: number = 300) {
        if (iterations >= TIMEOUT_ITERATIONS) {
            error = true;
            return;
        }
        if (!ready) {
            window.setTimeout(() => waitUntilReady(url, iterations + 1), defer * 2);
        }
    }

    function updateTheme(theme: Theme) {
        if (ready) {
            sendMessage(iframe, origin, {
                kind: "set_theme",
                theme,
            });
        }
    }

    let iframe: HTMLIFrameElement;

    function debug(msg: string, ...params: unknown[]): void {
        console.debug(`OPENCHAT_EXTERNAL_HOST: ${msg}`, params);
    }

    async function onFrameLoaded(iframe: HTMLIFrameElement): Promise<OpenChatXFrame> {
        debug("iframe loaded");
        return new Promise((resolve) => {
            window.addEventListener("message", (ev) => {
                if (ev.origin === origin && ev.data.kind === "external_content_ready") {
                    debug("External content signals its readiness");
                    sendMessage(iframe, origin, {
                        kind: "initialise_external_content",
                        theme: $currentTheme,
                        username: $user.username,
                    });
                    ready = true;
                    resolve({});
                }
            });
        });
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
{:else if error}
    <div class="error">
        <AlertCircleOutline size={"2em"} color={"var(--error)"} />
        <Translatable resourceKey={i18nKey("externalContent.error")} />
    </div>
{:else if !ready}
    <div class="loading">
        <div class="loader">
            <FancyLoader />
        </div>
        <Translatable resourceKey={i18nKey("externalContent.initialising")} />
    </div>
{/if}

{#if !frozen}
    <iframe
        class:ready
        title="External Content"
        on:load={() => onFrameLoaded(iframe)}
        bind:this={iframe}
        src={externalUrl} />
{/if}

<style lang="scss">
    iframe {
        height: 100%;
        width: 100%;
        display: none;

        &.ready {
            display: block;
        }
    }

    .error,
    .loading {
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

    .loader {
        width: toRem(48);
        height: toRem(48);
    }
</style>
