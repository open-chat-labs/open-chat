<script lang="ts">
    import page from "page";
    import { onMount, getContext } from "svelte";
    import Headline from "./Headline.svelte";
    import type { OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";

    const client = getContext<OpenChat>("client");

    let message: string | undefined = undefined;

    onMount(() => {
        const qs = window.location.search;
        page.replace("/auth");

        if (qs.length === 0) {
            message = "magicLink.noLink";
            return;
        }

        client
            .handleMagicLink(qs)
            .then((resp) => {
                message = "magicLink." + resp.kind;
            })
            .catch((_) => {
                message = "magicLink.link_invalid";
            });
    });
</script>

<div class="page">
    <Headline><Translatable resourceKey={i18nKey("magicLink.title")} /></Headline>
    {#if message === undefined}
        <div class="loading">
            <FancyLoader />
        </div>
    {:else}
        <p><Translatable resourceKey={i18nKey(message)} /></p>
    {/if}
</div>

<style lang="scss">
    .page {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }

    .loading {
        width: toRem(48);
        height: toRem(48);
    }
</style>
