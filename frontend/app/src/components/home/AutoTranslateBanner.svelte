<script lang="ts">
    import type { ChatIdentifier } from "@client";
    import { locale } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import {
        autoTranslateEnabled,
        languageName as cachedLanguageName,
        onDeviceTranslator,
        setAutoTranslate,
    } from "../../utils/onDeviceTranslation.svelte";
    import Link from "../Link.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        chatId: ChatIdentifier;
    }

    let { chatId }: Props = $props();

    let enabled = $derived(autoTranslateEnabled(chatId));

    $effect(() => {
        onDeviceTranslator.setTarget($locale);
    });

    function languageName(code: string): string {
        return cachedLanguageName(code, $locale);
    }

    let targetLanguage = $derived(languageName(onDeviceTranslator.target));

    // Report the slowest pack in flight
    let progress = $derived(
        onDeviceTranslator.downloads.size > 0
            ? Math.round(Math.min(...onDeviceTranslator.downloads.values()) * 100)
            : undefined,
    );

    let missingLanguages = $derived(
        [...onDeviceTranslator.needsDownload].map(languageName).join(", "),
    );
    let downloadingLanguages = $derived(
        [...onDeviceTranslator.downloads.keys()].map(languageName).join(", "),
    );
</script>

{#if enabled}
    <div class="auto-translate-banner" class:error={onDeviceTranslator.error !== undefined}>
        <span class="status">
            {#if onDeviceTranslator.error !== undefined}
                <Translatable resourceKey={i18nKey("autoTranslate.failed")} />
            {:else if onDeviceTranslator.needsDownload.size > 0}
                <Link underline={"hover"} onClick={() => onDeviceTranslator.prime()}>
                    <Translatable
                        resourceKey={i18nKey("autoTranslate.downloadPacks", {
                            languages: missingLanguages,
                        })} />
                </Link>
            {:else if progress !== undefined}
                <Translatable resourceKey={i18nKey("autoTranslate.downloading", {
                        languages: downloadingLanguages,
                        progress,
                    })} />
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
