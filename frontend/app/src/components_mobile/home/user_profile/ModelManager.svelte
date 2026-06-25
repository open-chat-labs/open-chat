<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { selectedModelId } from "@src/stores/onDeviceModels";
    import { defaultModelCatalog } from "@utils/modelCatalog";
    import { isNativeClient } from "@utils/onDeviceInference";
    import { BodySmall, Button, Caption, Chip, Container, H2, Switch } from "component-lib";
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
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    // On-device inference runs wherever the Tauri native bridge is present (desktop + mobile); degrade
    // gracefully in the plain web/PWA build.
    const native = isNativeClient();

    // The catalog is data (currently the built-in default; could be fetched). Nothing is bundled.
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

<SlidingPageContent title={i18nKey("On-device models")} subtitle={i18nKey("Run AI privately on your device")}>
    <Container padding={"xxl"} gap={"lg"} height={"fill"} direction={"vertical"}>
        {#if !native}
            <BodySmall>
                <Translatable
                    resourceKey={i18nKey(
                        "On-device models are only available in the OpenChat desktop or mobile app.",
                    )}></Translatable>
            </BodySmall>
        {:else}
            <H2 fontWeight={"bold"} colour={"primary"}>
                <Translatable resourceKey={i18nKey("Available models")}></Translatable>
            </H2>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Models run entirely on your device — nothing you ask them is sent to a server. Downloads are large; use Wi-Fi.",
                    )}></Translatable>
            </BodySmall>

            {#each catalog as entry (entry.id)}
                {@const downloaded = isDownloaded(entry.id)}
                {@const busy = downloading[entry.id] === true}
                <Container gap={"sm"} direction={"vertical"}>
                    <BodySmall fontWeight={"bold"}>{entry.name}</BodySmall>
                    {#if entry.description}
                        <Caption colour={"textSecondary"}>{entry.description}</Caption>
                    {/if}
                    <Container gap={"sm"} direction={"horizontal"} crossAxisAlignment={"center"}>
                        {#each entry.modalities as modality}
                            <Chip>{modality}</Chip>
                        {/each}
                        <Caption colour={"textSecondary"}>{formatSize(entry.sizeBytes)}</Caption>
                    </Container>

                    {#if downloaded}
                        <Container gap={"sm"} direction={"horizontal"}>
                            <Button disabled={selected === entry.id} onClick={() => select(entry.id)}>
                                <Translatable
                                    resourceKey={i18nKey(selected === entry.id ? "Selected" : "Select")}
                                ></Translatable>
                            </Button>
                            <Button secondary onClick={() => remove(entry.id)}>
                                <Translatable resourceKey={i18nKey("Remove")}></Translatable>
                            </Button>
                        </Container>
                    {:else if busy}
                        <div class="progress-track">
                            <div class="progress-fill" style={`width:${percent(entry.id)}%`}></div>
                        </div>
                        <Caption colour={"textSecondary"}>
                            {percent(entry.id)}% · {formatSize(progress[entry.id]?.received ?? 0)} / {formatSize(
                                entry.sizeBytes,
                            )}
                        </Caption>
                    {:else}
                        <Caption colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("License:")}></Translatable>
                            {" "}
                            {#if entry.licenseUrl}
                                <a href={entry.licenseUrl} target="_blank" rel="noopener noreferrer"
                                    >{entry.license}</a>
                            {:else}
                                {entry.license}
                            {/if}
                        </Caption>
                        <Switch
                            bound={false}
                            checked={accepted[entry.id] === true}
                            onChange={() =>
                                (accepted = { ...accepted, [entry.id]: accepted[entry.id] !== true })}>
                            <Caption>
                                <Translatable
                                    resourceKey={i18nKey("I have read and accept the license")}
                                ></Translatable>
                            </Caption>
                        </Switch>
                        <Container gap={"sm"} direction={"horizontal"} crossAxisAlignment={"center"}>
                            <Button
                                disabled={accepted[entry.id] !== true}
                                onClick={() => download(entry)}>
                                <Translatable resourceKey={i18nKey("Download")}></Translatable>
                            </Button>
                        </Container>
                        {#if errors[entry.id]}
                            <Caption colour={"error"}>{errors[entry.id]}</Caption>
                        {/if}
                    {/if}
                </Container>
            {/each}

            {#if loading}
                <BodySmall><Translatable resourceKey={i18nKey("Loading…")}></Translatable></BodySmall>
            {/if}
        {/if}
    </Container>
</SlidingPageContent>

<style lang="scss">
    .progress-track {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background-color: var(--input-bg, rgba(0, 0, 0, 0.1));
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background-color: var(--accent, #4a90d9);
        transition: width 0.2s ease;
    }
    a {
        color: var(--accent, #4a90d9);
        text-decoration: underline;
    }
</style>
