<script lang="ts">
    import { onMount, getContext, createEventDispatcher } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    import FancyLoader from "./icons/FancyLoader.svelte";
    import ModalContent from "./ModalContent.svelte";
    import { pageReplace } from "../routes";
    import page from "page";
    import Pincode from "./pincode/Pincode.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let qs = window.location.search;
    let status: string | undefined = undefined;
    let message = "magicLink.closeMessage";
    let busy = false;

    onMount(() => {
        pageReplace("/home");
    });

    function onCodeEntered(ev: CustomEvent<{ code: string[]; value: string }>) {
        if (!isCodeComplete(ev.detail.code)) {
            return;
        }

        if (!isCodeValid(ev.detail.code)) {
            status = "magicLink.code_invalid";
            return;
        }

        qs += "&u=" + ev.detail.value;

        busy = true;

        client
            .handleMagicLink(qs)
            .then((resp) => {
                if (resp.kind === "success") {
                    page("/communities");
                    close();
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

    function isCodeComplete(code: string[]): boolean {
        return code.filter((c) => c.length > 0).length === 3;
    }

    function isCodeValid(code: string[]): boolean {
        return code.filter((c) => /^[0-9]$/.test(c)).length === 3;
    }

    function close() {
        dispatch("close");
    }
</script>

<div class="magic-link">
    <ModalContent hideFooter>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("magicLink.title")} />
        </div>
        <div class="body" slot="body">
            <div>
                {#if busy}
                    <div class="loading">
                        <FancyLoader />
                    </div>
                {:else if status === undefined}
                    <p><Translatable resourceKey={i18nKey("magicLink.enterCode")} /></p>

                    <Pincode length={3} on:complete={onCodeEntered}></Pincode>
                {:else}
                    <p class="status"><Translatable resourceKey={i18nKey(status)} /></p>
                    <p class="message"><Translatable resourceKey={i18nKey(message)} /></p>
                {/if}
            </div>
        </div>
    </ModalContent>
</div>

<style lang="scss">
    :global(.magic-link .modal-content) {
        min-width: 576px;
        color: var(--txt);
        padding: $sp3;
        text-align: center;

        @include mobile() {
            min-width: auto;
        }
    }

    :global(.magic-link .modal-content .header h4) {
        font-size: toRem(36);
        line-height: 1.2;

        @include mobile() {
            font-size: toRem(28);
        }
    }

    .body {
        display: flex;
        justify-content: center;
    }

    .loading {
        width: toRem(48);
        height: toRem(48);
    }

    .status {
        font-weight: bold;
    }

    p {
        margin-bottom: $sp4;
    }
</style>
