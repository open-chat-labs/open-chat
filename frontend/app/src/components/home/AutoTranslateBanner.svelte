<script lang="ts">
    import type { ChatIdentifier } from "@client";
    import { locale } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import {
        autoTranslateEnabled,
        onDeviceTranslator,
        setAutoTranslate,
    } from "../../utils/onDeviceTranslation";
    import Link from "../Link.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        chatId: ChatIdentifier;
    }

    let { chatId }: Props = $props();

    const downloads = onDeviceTranslator.downloads;
    const needsDownload = onDeviceTranslator.needsDownload;
    const error = onDeviceTranslator.error;

    let enabled = $derived(autoTranslateEnabled(chatId));

    $effect(() => {
        onDeviceTranslator.setTarget($locale);
    });

    function languageName(code: string): string {
        try {
            return (
                new Intl.DisplayNames([$locale ?? "en"], { type: "language" }).of(code) ?? code
            );
        } catch {
            return code;
        }
    }

    const target = onDeviceTranslator.targetLanguage;
    let targetLanguage = $derived(languageName($target));

    // Report the slowest pack in flight
    let progress = $derived(
        $downloads.size > 0 ? Math.round(Math.min(...$downloads.values()) * 100) : undefined,
    );

    let missingLanguages = $derived([...$needsDownload].map(languageName).join(", "));
    let downloadingLanguages = $derived([...$downloads.keys()].map(languageName).join(", "));
</script>

{#if $enabled}
    <div class="auto-translate-banner" class:error={$error !== undefined}>
        <span class="status">
            {#if $error !== undefined}
                <Translatable resourceKey={i18nKey("autoTranslate.failed")} />
            {:else if $needsDownload.size > 0}
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
