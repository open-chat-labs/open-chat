<script lang="ts">
    import { onMount, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    import FancyLoader from "./icons/FancyLoader.svelte";
    import ModalContent from "./ModalContent.svelte";
    import { pageReplace } from "../routes";

    const client = getContext<OpenChat>("client");

    let status: string | undefined = undefined;
    let message = "";

    onMount(() => {
        const qs = window.location.search;

        pageReplace("/home");

        client
            .handleMagicLink(qs)
            .then((resp) => {
                status = "magicLink." + resp.kind;
                message =
                    "magicLink." + (resp.kind === "success" ? "continueMessage" : "closeMessage");
            })
            .catch((_) => {
                status = "magicLink.link_invalid";
            });
    });
</script>

<div class="magic-link">
    <ModalContent hideFooter>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("magicLink.title")} />
        </div>
        <div class="body" slot="body">
            <div>
                {#if status === undefined}
                    <div class="loading">
                        <FancyLoader />
                    </div>
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
        margin-bottom: $sp4;
    }
</style>
