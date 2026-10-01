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

    const download = onDeviceTranslator.download;
    const error = onDeviceTranslator.error;

    let enabled = $derived(autoTranslateEnabled(chatId));

    $effect(() => {
        onDeviceTranslator.setTarget($locale);
    });

    let targetLanguage = $derived.by(() => {
        try {
            return (
                new Intl.DisplayNames([$locale ?? "en"], { type: "language" }).of(
                    onDeviceTranslator.target,
                ) ?? onDeviceTranslator.target
            );
        } catch {
            return onDeviceTranslator.target;
        }
    });

    let progress = $derived(
        $download !== undefined ? Math.round($download.progress * 100) : undefined,
    );
</script>

{#if $enabled}
    <div class="auto-translate-banner" class:error={$error !== undefined}>
        <span class="status">
            {#if $error !== undefined}
                <Translatable resourceKey={i18nKey("autoTranslate.failed")} />
            {:else if progress !== undefined}
                <Translatable resourceKey={i18nKey("autoTranslate.downloading", { progress })} />
            {:else}
                <Translatable
                    resourceKey={i18nKey("autoTranslate.active", { language: targetLanguage })} />
            {/if}
        </span>
        <Link underline={"always"} onClick={() => setAutoTranslate(chatId, false)}>
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
        padding: $sp2 $sp4;
        background-color: var(--entry-bg);
        border-bottom: var(--bw) solid var(--bd);
        color: var(--txt-light);

        &.error {
            color: var(--error);
        }
    }
</style>
