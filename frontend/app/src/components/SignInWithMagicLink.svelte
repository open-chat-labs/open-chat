<script lang="ts">
    import { onMount, getContext, tick } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    import FancyLoader from "./icons/FancyLoader.svelte";
    import ModalContent from "./ModalContent.svelte";
    import { pageReplace } from "../routes";
    import page from "page";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();
    let qs = window.location.search;
    let status: string | undefined = $state(undefined);
    let message = $state("magicLink.closeMessage");
    let busy = $state(false);
    let code: string | undefined = $state();
    let codeRef: HTMLInputElement | undefined = $state();

    onMount(() => {
        pageReplace("/home");

        tick().then(() => {
            codeRef?.focus();
        });
    });

    function onCodeEntered() {
        if (code === undefined || !isCodeValid(code)) {
            status = "magicLink.code_invalid";
            return;
        }

        qs += "&c=" + code;

        busy = true;

        client
            .handleMagicLink(qs)
            .then((resp) => {
                if (resp.kind === "success") {
                    page("/communities");
                    onClose();
                } else if (resp.kind === "session_not_found") {
                    message = "magicLink.continueMessage";
                    status = "magicLink.success";
                } else {
                    status = "magicLink." + resp.kind;
                }
            })
            .catch((_) => {
                status = "magicLink.link_invalid";
            })
            .finally(() => (busy = false));
    }

    function isCodeValid(code: string): boolean {
        return Array.from(code).filter((c) => /^[0-9]$/.test(c)).length === 3;
    }

    $effect(() => {
        if (code !== undefined && code.length >= 3 && status === undefined) {
            onCodeEntered();
        }
    });
</script>

<div class="magic-link">
    <ModalContent hideFooter>
        {#snippet header()}
            <Translatable resourceKey={i18nKey("magicLink.title")} />
        {/snippet}
        {#snippet body()}
            <div class="body">
                {#if busy}
                    <div class="loading">
                        <FancyLoader loop={busy} />
                    </div>
                {/if}

                {#if status === undefined}
                    {#if !busy}
                        <div><Translatable resourceKey={i18nKey("magicLink.enterCode")} /></div>
                    {/if}

                    <input
                        bind:this={codeRef}
                        type="text"
                        inputmode="numeric"
                        pattern={"[0-9]{1}"}
                        maxlength={3}
                        disabled={busy || status !== undefined}
                        bind:value={code} />

                    <!-- <Pincode length={3} on:complete={onCodeEntered} /> -->
                {:else}
                    <p class="status"><Translatable resourceKey={i18nKey(status)} /></p>
                    <p><Translatable resourceKey={i18nKey(message)} /></p>
                {/if}
            </div>
        {/snippet}
    </ModalContent>
</div>

<style lang="scss">
    :global(.magic-link .modal-content) {
        color: var(--txt);
        padding: $sp3;
        text-align: center;
    }

    :global(.magic-link .modal-content .header h4) {
        font-size: toRem(36);
        line-height: 1.2;

        @include mobile() {
            font-size: toRem(28);
        }
    }

    .magic-link {
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .body {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 12px;
    }

    .loading {
        width: toRem(48);
        height: toRem(48);
    }

    .status {
        font-weight: bold;
    }

    input {
        padding: 0.5rem 1rem;
        margin: 0;
        border: 0;
        border-radius: 0;
        letter-spacing: 0.25em;
        font-size: toRem(18);
        text-align: center;
        width: 100px;
        margin-bottom: $sp4;
    }
</style>
