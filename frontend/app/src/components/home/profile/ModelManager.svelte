<script lang="ts">
    import { selectedModelId } from "@src/stores/onDeviceModels";
    import { defaultModelCatalog } from "@utils/modelCatalog";
    import { isNativeClient } from "@utils/onDeviceInference";
    import type { ModelCatalogEntry } from "openchat-shared";
    import { onDestroy, onMount } from "svelte";
    import { get } from "svelte/store";
    import {
        deleteModel,
        downloadModel,
        listLocalModels,
        onModelDownloadProgress,
        type LocalModel,
    } from "tauri-plugin-oc-api";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "../../Translatable.svelte";

    // On-device inference runs wherever the Tauri native bridge is present (desktop + mobile); degrade
    // gracefully in the plain web/PWA build. The catalog is data; nothing is bundled.
    const native = isNativeClient();
    const catalog = defaultModelCatalog.models;

    let localModels = $state<LocalModel[]>([]);
    let loading = $state(false);
    let selected = $state(get(selectedModelId));

    // Per-model ephemeral UI state, keyed by catalog entry id.
    let progress = $state<Record<string, { received: number; total: number }>>({});
    let downloading = $state<Record<string, boolean>>({});
    let accepted = $state<Record<string, boolean>>({});
    let errors = $state<Record<string, string>>({});

    let unlisten: (() => void) | undefined;

    function isDownloaded(id: string): boolean {
        return localModels.some((m) => m.modelId === id);
    }

    async function load() {
        if (!native) return;
        loading = true;
        try {
            localModels = await listLocalModels();
        } catch {
            localModels = [];
        } finally {
            loading = false;
        }
    }

    async function download(entry: ModelCatalogEntry) {
        errors = { ...errors, [entry.id]: "" };
        downloading = { ...downloading, [entry.id]: true };
        progress = { ...progress, [entry.id]: { received: 0, total: entry.sizeBytes } };
        try {
            await downloadModel({ modelId: entry.id, runtime: entry.runtime, files: entry.files });
            await load();
        } catch (e) {
            errors = { ...errors, [entry.id]: String(e) };
        } finally {
            downloading = { ...downloading, [entry.id]: false };
        }
    }

    function select(id: string) {
        selectedModelId.set(id);
        selected = id;
    }

    async function remove(id: string) {
        await deleteModel(id);
        if (selected === id) {
            selectedModelId.set("");
            selected = "";
        }
        await load();
    }

    function formatSize(bytes: number): string {
        const gb = bytes / 1024 / 1024 / 1024;
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`;
    }

    function percent(id: string): number {
        const p = progress[id];
        if (p === undefined || p.total === 0) return 0;
        return Math.min(100, Math.round((p.received / p.total) * 100));
    }

    onMount(async () => {
        await load();
        if (native) {
            unlisten = await onModelDownloadProgress((p) => {
                progress = {
                    ...progress,
                    [p.modelId]: { received: p.receivedBytes, total: p.totalBytes },
                };
            });
        }
    });

    onDestroy(() => unlisten?.());
</script>

{#if !native}
    <p class="blurb">
        <Translatable
            resourceKey={i18nKey(
                "On-device models are only available in the OpenChat desktop or mobile app.",
            )} />
    </p>
{:else}
    <p class="blurb">
        <Translatable
            resourceKey={i18nKey(
                "Models run entirely on your device — nothing you ask them is sent to a server. Downloads are large; use Wi-Fi.",
            )} />
    </p>

    {#each catalog as entry (entry.id)}
        {@const downloaded = isDownloaded(entry.id)}
        {@const busy = downloading[entry.id] === true}
        <div class="model">
            <div class="name">{entry.name}</div>
            {#if entry.description}
                <div class="desc">{entry.description}</div>
            {/if}
            <div class="meta">
                {#each entry.modalities as modality}
                    <span class="chip">{modality}</span>
                {/each}
                <span class="size">{formatSize(entry.sizeBytes)}</span>
            </div>

            {#if downloaded}
                <div class="actions">
                    <Button disabled={selected === entry.id} onClick={() => select(entry.id)} small>
                        <Translatable
                            resourceKey={i18nKey(selected === entry.id ? "Selected" : "Select")} />
                    </Button>
                    <Button secondary onClick={() => remove(entry.id)} small>
                        <Translatable resourceKey={i18nKey("Remove")} />
                    </Button>
                </div>
            {:else if busy}
                <div class="progress-track">
                    <div class="progress-fill" style={`width:${percent(entry.id)}%`}></div>
                </div>
                <div class="size">
                    {percent(entry.id)}% · {formatSize(progress[entry.id]?.received ?? 0)} / {formatSize(
                        entry.sizeBytes,
                    )}
                </div>
            {:else}
                <div class="size">
                    <Translatable resourceKey={i18nKey("License:")} />
                    {" "}
                    {#if entry.licenseUrl}
                        <a href={entry.licenseUrl} target="_blank" rel="noopener noreferrer"
                            >{entry.license}</a>
                    {:else}
                        {entry.license}
                    {/if}
                </div>
                <Toggle
                    id={`accept-${entry.id}`}
                    small
                    checked={accepted[entry.id] === true}
                    onChange={() =>
                        (accepted = { ...accepted, [entry.id]: accepted[entry.id] !== true })}
                    label={i18nKey("I have read and accept the license")} />
                <div class="actions">
                    <Button
                        disabled={accepted[entry.id] !== true}
                        onClick={() => download(entry)}
                        small>
                        <Translatable resourceKey={i18nKey("Download")} />
                    </Button>
                </div>
                {#if errors[entry.id]}
                    <div class="error">{errors[entry.id]}</div>
                {/if}
            {/if}
        </div>
    {/each}

    {#if loading}
        <p class="blurb"><Translatable resourceKey={i18nKey("Loading…")} /></p>
    {/if}
{/if}

<style lang="scss">
    .blurb {
        @include font-size(fs-80);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
    .model {
        display: flex;
        flex-direction: column;
        gap: $sp2;
        padding: $sp3 0;
        border-bottom: 1px solid var(--bd);
        &:last-child {
            border-bottom: none;
        }
    }
    .name {
        @include font(bold, normal, fs-90);
    }
    .desc {
        @include font-size(fs-80);
        color: var(--txt-light);
    }
    .meta {
        display: flex;
        gap: $sp2;
        align-items: center;
        flex-wrap: wrap;
    }
    .chip {
        @include font-size(fs-60);
        padding: 2px $sp2;
        border-radius: var(--rd);
        background-color: var(--input-bg);
        color: var(--txt-light);
    }
    .size {
        @include font-size(fs-70);
        color: var(--txt-light);
    }
    .actions {
        display: flex;
        gap: $sp3;
        margin-top: $sp2;
    }
    .error {
        @include font-size(fs-70);
        color: var(--error);
    }
    .progress-track {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background-color: var(--input-bg);
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background-color: var(--accent);
        transition: width 0.2s ease;
    }
    a {
        color: var(--accent);
        text-decoration: underline;
    }
</style>
