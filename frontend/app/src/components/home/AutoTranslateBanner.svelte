<script lang="ts">
    import type { ChatIdentifier } from "@client";
    import { locale } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import {
        autoTranslateEnabled,
        languageName as cachedLanguageName,
        onDeviceTranslationSupported,
        onDeviceTranslator,
        setAutoTranslate,
    } from "../../utils/onDeviceTranslation.svelte";
    import Link from "../Link.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        chatId: ChatIdentifier;
    }

    let { chatId }: Props = $props();

    // A chat can stay switched on in localStorage after the browser loses the APIs
    let supported = $state(false);
    onDeviceTranslationSupported().then((s) => (supported = s));
    let enabled = $derived(supported && autoTranslateEnabled(chatId));

    $effect(() => {
        onDeviceTranslator.setTarget($locale);
    });

    function languageName(code: string): string {
        return cachedLanguageName(code, $locale);
    }

    let targetLanguage = $derived(languageName(onDeviceTranslator.target));

    let download = $derived(onDeviceTranslator.currentDownload);
</script>

{#if enabled}
    <div class="auto-translate-banner" class:error={onDeviceTranslator.error !== undefined}>
        <span class="status">
            {#if onDeviceTranslator.error !== undefined}
                <Translatable resourceKey={i18nKey("autoTranslate.failed")} />
            {:else if download !== undefined}
                <Translatable
                    resourceKey={i18nKey("autoTranslate.downloading", {
                        language: languageName(download.source),
                        index: download.index,
                        total: download.total,
                    })} />
            {:else if onDeviceTranslator.needsDownload.size > 0}
                <Link underline={"hover"} onClick={() => onDeviceTranslator.prime()}>
                    <Translatable
                        resourceKey={i18nKey("autoTranslate.downloadPacks", {
                            count: onDeviceTranslator.needsDownload.size,
                        })} />
                </Link>
            {:else}
                <Translatable
                    resourceKey={i18nKey("autoTranslate.active", { language: targetLanguage })} />
            {/if}
        </span>
        <Link underline={"hover"} onClick={() => setAutoTranslate(chatId, false)}>
            <Translatable resourceKey={i18nKey("autoTranslate.turnOff")} />
        </Link>
    </div>
{/if}

<style lang="scss">
    .auto-translate-banner {
        @include font(book, normal, fs-70);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
        padding: $sp3 $sp4;
        background-color: var(--entry-bg);
        border-bottom: var(--bw) solid var(--bd);
        color: var(--txt-light);

        &.error {
            color: var(--error);
        }
    }
</style>
