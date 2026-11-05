<!-- A prize's human check (HumanCheck), run in a frame from the website (public/turnstile.html) once
     the reader clicks Claim. The apps load it from the website too: Cloudflare fails every check run
     on the iOS app's tauri:// page, but passes one in a frame from a web origin. There's no frame
     until a claim runs the check, and it takes no room unless Cloudflare asks the reader to tick
     its box. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import { isHumanCheckMessage, type HumanCheck } from "@src/logic/prize/humanCheck.svelte";
    import { baseOrigin, turnstileSiteKey } from "@src/utils/openchatClient";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        check: HumanCheck;
        /** prizeClaimCustomData */
        customData: string;
    }

    let { check, customData }: Props = $props();

    const client = getContext<OpenChat>("client");
    const origin = client.isNativeApp() ? baseOrigin : window.location.origin;

    let frame = $state<HTMLIFrameElement>();
    let src = $derived(
        `${origin}/turnstile.html#${new URLSearchParams({ sitekey: turnstileSiteKey, cdata: customData })}`,
    );

    function onMessage(e: MessageEvent) {
        if (
            e.origin === origin &&
            e.source === frame?.contentWindow &&
            isHumanCheckMessage(e.data)
        ) {
            check.receive(e.data);
        }
    }
</script>

<svelte:window onmessage={onMessage} />

{#if check.running}
    {#key check.run}
        <iframe
            bind:this={frame}
            {src}
            title={$_("prizes.humanCheck")}
            class:interactive={check.interactive}></iframe>
    {/key}
{/if}

<style lang="scss">
    iframe {
        display: block;
        width: 100%;
        height: 0;
        border: 0;

        // Turnstile's checkbox
        &.interactive {
            height: 65px;
        }
    }
</style>
