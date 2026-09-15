<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { selectedModelId } from "@src/stores/onDeviceModels";
    import {
        addCustomModel,
        customModels,
        fileNameFromUrl,
        makeCustomModelId,
        recordDownloadedHashes,
        removeCustomModel,
        toDisplay,
        type CustomModelEntry,
        type CustomModelFile,
        type DisplayModel,
    } from "@src/stores/customModels";
    import {
        defaultModelCatalog,
        mergeCatalogs,
        nativeModelInstallStatus,
    } from "@utils/modelCatalog";
    import { isNativeClient, usesWebInferenceRuntime } from "@utils/onDeviceInference";
    import { transformersWebGpuSelectionCanHandle } from "@utils/transformersWebGpuInference";
    import { transformersWebGpuModelSpec } from "@utils/transformersWebGpuProtocol";
    import { webGpuModelCatalog } from "@src/stores/webGpuModelCatalog";
    import WebGpuModelCatalogSettings from "../../../components_shared/WebGpuModelCatalogSettings.svelte";
    import {
        cancelWebModelDownload,
        clearWebModel,
        ensureWebModelRestored,
        refreshWebModelInstallStatus,
        useWebModelFromUrl,
        webModelInstallStatus,
        webModelStatus,
    } from "@utils/webInference";
    import {
        assessSuitability,
        hasBlocker,
        type SuitabilityWarning,
        type UrlProbe,
    } from "@utils/modelSuitability";
    import { BodySmall, Button, Caption, Chip, Container, H2, Input, Switch } from "component-lib";
    import type { OpenChat } from "@client";
    import type { ModelCatalogEntry, ModelModality } from "@shared";
    import { getContext, onDestroy, onMount } from "svelte";
    import { get } from "svelte/store";
    import {
        deleteModel,
        downloadModel,
        listLocalModels,
        onModelDownloadProgress,
        probeModelUrl,
        systemResources,
        type LocalModel,
        type SystemResources,
    } from "tauri-plugin-oc-api";
    import Translatable from "../../Translatable.svelte";
    import BrowserImageActionModeSettings from "../../../components_shared/BrowserImageActionModeSettings.svelte";
    import WebInferenceRuntimeSettings from "../../../components_shared/WebInferenceRuntimeSettings.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    // On-device inference runs wherever the Tauri native bridge is present (desktop + mobile); degrade
    // gracefully in the plain web/PWA build.
    const client = getContext<OpenChat>("client");
    // A feature-flagged local Android APK deliberately uses the same pinned all-WebGPU chooser as
    // mobile Chrome. Other Tauri clients retain the native llama.cpp manager.
    const nativeClient = isNativeClient();
    const native = nativeClient && !usesWebInferenceRuntime();

    let webError = $state("");
    let webErrorModelId = $state<string | undefined>(undefined);
    let webChoiceGeneration = 0;
    async function detachWebModel() {
        webError = "";
        webErrorModelId = undefined;
        const removing = $webModelStatus.id;
        try {
            await clearWebModel();
        } catch (error) {
            webError = error instanceof Error ? error.message : String(error);
            webErrorModelId = removing;
        }
    }

    // The OpenChat-hosted catalog (owner-curated on the registry, updatable without a client release)
    // may rank or add entries, but this build's trusted artifact wins for every built-in id. Built-in
    // leftovers are appended, so a stale/partial remote catalog can never shrink the chooser.
    let catalogSource = $state<ModelCatalogEntry[]>(defaultModelCatalog.models);

    // The validated WebGPU catalog controls the enabled list, immutable artifacts and capabilities.
    // Legacy native catalog metadata contributes licence links only.
    let webChoices = $derived(
        $webGpuModelCatalog.models
            .filter((spec) => transformersWebGpuSelectionCanHandle(spec.id))
            .map((spec) => {
                const metadata = catalogSource.find((entry) => entry.id === spec.id);
                return {
                    id: spec.id,
                    name: spec.name,
                    description: spec.description,
                    modalities: [...spec.modalities],
                    runtime: "transformers-webgpu" as const,
                    files: [],
                    license: metadata?.license ?? "Pinned model repository terms",
                    licenseUrl: metadata?.licenseUrl,
                    sizeBytes: spec.artifactBytes,
                } satisfies ModelCatalogEntry;
            }),
    );

    // The chooser list always renders except while its owned preload is active; an exact catalog id
    // marks the already-selected pinned runtime as Current.
    let webActive = $derived(
        $webModelStatus.status === "attached" ||
            $webModelStatus.status === "loading" ||
            $webModelStatus.status === "loaded",
    );
    let currentWebId = $derived(webActive ? $webModelStatus.id : undefined);
    let webRuntimeSettingsBusy = $derived(
        $webModelStatus.status === "downloading" ||
            $webModelStatus.status === "verifying" ||
            $webModelStatus.status === "loading",
    );
    let webStatusText = $derived(
        $webModelStatus.status === "loading"
            ? "loading into memory…"
            : $webModelStatus.status === "loaded"
              ? "loaded"
              : "attached — loads on first use",
    );

    // Selection owns the complete pinned ONNX preload and verifies every artifact before activation.
    async function chooseWebModel(entry: ModelCatalogEntry) {
        const generation = ++webChoiceGeneration;
        webError = "";
        webErrorModelId = undefined;
        const error = await useWebModelFromUrl({
            id: entry.id,
            name: entry.name,
            files: entry.files,
            sizeBytes: entry.sizeBytes,
            modalities: entry.modalities,
        });
        if (generation === webChoiceGeneration) {
            webError = error ?? "";
            webErrorModelId = error === undefined ? undefined : entry.id;
        }
    }

    async function loadCatalog() {
        try {
            const remote = await client.modelCatalog();
            catalogSource = mergeCatalogs(remote.models, defaultModelCatalog.models);
        } catch {
            // keep the built-in default (offline / not yet configured)
        }
    }

    // What the list renders: the registry/default catalog ⊕ the user's device-local custom models.
    let display = $derived<DisplayModel[]>([...catalogSource.map(toDisplay), ...$customModels]);

    let localModels = $state<LocalModel[]>([]);
    let loading = $state(false);
    let selected = $state(get(selectedModelId));

    // Per-model ephemeral UI state, keyed by catalog entry id.
    let progress = $state<Record<string, { received: number; total: number }>>({});
    let downloading = $state<Record<string, boolean>>({});
    let accepted = $state<Record<string, boolean>>({});
    let errors = $state<Record<string, string>>({});

    // "Add a model from URL" form state.
    let showAdd = $state(false);
    let addUrl = $state("");
    let addMmprojUrl = $state("");
    let addName = $state("");
    let checking = $state(false);
    let checked = $state(false);
    let warnings = $state<SuitabilityWarning[]>([]);
    let addError = $state("");
    // Probes captured by "Check", reused by "Add & Download" (for the entry's file sizes).
    let primaryProbe = $state<UrlProbe | undefined>(undefined);
    let mmprojProbe = $state<UrlProbe | undefined>(undefined);
    // The exact inputs "Check" ran against. The assessment (and captured probe sizes) are only valid while
    // the fields still match — editing the URL afterwards makes checkFresh false, hiding Add & Download
    // until a fresh Check, so a stale passing assessment can't be used to bypass the blockers.
    let checkedUrl = $state("");
    let checkedMmproj = $state("");
    let checkFresh = $derived(
        checked && addUrl.trim() === checkedUrl && addMmprojUrl.trim() === checkedMmproj,
    );

    let unlisten: (() => void) | undefined;

    function installStatus(entry: DisplayModel) {
        return nativeModelInstallStatus(entry, localModels);
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

    async function download(entry: DisplayModel) {
        errors = { ...errors, [entry.id]: "" };
        downloading = { ...downloading, [entry.id]: true };
        progress = { ...progress, [entry.id]: { received: 0, total: entry.sizeBytes } };
        try {
            const res = await downloadModel({
                modelId: entry.id,
                runtime: entry.runtime,
                files: entry.files,
            });
            // For a trust-on-first-use custom model, persist the observed hashes so a later re-download
            // is integrity-checked against the first.
            if (entry.custom === true) {
                recordDownloadedHashes(entry.id, res.files);
            }
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

    async function remove(entry: DisplayModel) {
        // Deleting can fail (e.g. the file is still mmap'd by the cached model on Windows) — surface it
        // rather than silently leaving the entry orphaned in the list + localStorage.
        try {
            await deleteModel(entry.id);
        } catch (e) {
            errors = { ...errors, [entry.id]: String(e) };
            return;
        }
        // Custom models also have a localStorage entry — remove it so it leaves the list entirely.
        if (entry.custom === true) {
            removeCustomModel(entry.id);
        }
        if (selected === entry.id) {
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

    // --- Add a model from URL ---

    function resetAdd() {
        showAdd = false;
        addUrl = "";
        addMmprojUrl = "";
        addName = "";
        checked = false;
        warnings = [];
        addError = "";
        checkedUrl = "";
        checkedMmproj = "";
        primaryProbe = undefined;
        mmprojProbe = undefined;
    }

    // Native preflight: probe the file(s) + read device resources, then assess suitability (no download).
    async function checkModel() {
        addError = "";
        const url = addUrl.trim();
        const mmproj = addMmprojUrl.trim();
        if (url === "") {
            addError = "Enter a model URL.";
            return;
        }
        checking = true;
        try {
            primaryProbe = await probeModelUrl(url);
            mmprojProbe = mmproj !== "" ? await probeModelUrl(mmproj) : undefined;
            let resources: SystemResources | undefined;
            try {
                resources = await systemResources();
            } catch {
                resources = undefined;
            }
            warnings = assessSuitability({
                url,
                mmprojUrl: mmproj !== "" ? mmproj : undefined,
                probe: primaryProbe,
                mmprojProbe,
                resources,
            });
            checkedUrl = url;
            checkedMmproj = mmproj;
            checked = true;
        } catch (e) {
            addError = String(e);
        } finally {
            checking = false;
        }
    }

    async function addAndDownload() {
        const url = addUrl.trim();
        const mmproj = addMmprojUrl.trim();
        // Only proceed against an assessment that matches the CURRENT inputs (checkFresh) — never a stale one.
        if (url === "" || !checkFresh || hasBlocker(warnings)) return;
        const primaryBytes = primaryProbe?.contentLength;
        if (primaryBytes === undefined || primaryBytes <= 0) {
            addError = "Check the model link again — a positive file size is required.";
            return;
        }

        // Force deterministic on-disk names so the native runtime classifies the files correctly: the
        // language model as "model.gguf" (find_gguf) and the projector as "mmproj.gguf" (find_mmproj),
        // regardless of what the source URLs are named.
        const files: CustomModelFile[] = [{ url, bytes: primaryBytes, filename: "model.gguf" }];
        if (mmproj !== "") {
            const projectorBytes = mmprojProbe?.contentLength;
            if (projectorBytes === undefined || projectorBytes <= 0) {
                addError =
                    "Check the vision projector link again — a positive file size is required.";
                return;
            }
            files.push({
                url: mmproj,
                bytes: projectorBytes,
                filename: "mmproj.gguf",
            });
        }
        const modalities: ModelModality[] = mmproj !== "" ? ["text", "image"] : ["text"];
        const name =
            addName.trim() !== "" ? addName.trim() : fileNameFromUrl(url) || "Custom model";
        const entry: CustomModelEntry = {
            id: makeCustomModelId(url),
            name,
            modalities,
            runtime: "llama-cpp",
            files,
            license: "User-provided (not verified by OpenChat)",
            sizeBytes: files.reduce((acc, f) => acc + f.bytes, 0),
            custom: true,
            sourceUrl: url,
            addedAt: Date.now(),
        };

        const result = addCustomModel(entry);
        if (!result.ok) {
            addError = result.error;
            return;
        }
        resetAdd();
        await download(entry);
    }

    onMount(async () => {
        void loadCatalog();
        await load();
        if (!native) {
            await ensureWebModelRestored();
            await refreshWebModelInstallStatus(webChoices.map((entry) => entry.id));
        }
        if (native) {
            unlisten = await onModelDownloadProgress((p) => {
                progress = {
                    ...progress,
                    [p.modelId]: { received: p.receivedBytes, total: p.totalBytes },
                };
            });
        }
    });

    onDestroy(() => {
        webChoiceGeneration += 1;
        cancelWebModelDownload();
        unlisten?.();
    });
</script>

<SlidingPageContent
    title={i18nKey("On-device models")}
    subtitle={i18nKey("Run AI privately on your device")}
>
    <Container padding={"xxl"} gap={"lg"} height={"fill"} direction={"vertical"}>
        {#if !native}
            <BodySmall>
                <Translatable
                    resourceKey={i18nKey(
                        "Choose the approved all-WebGPU phone model below. Its complete pinned download happens on this page; running a message never downloads a GGUF fallback. Keep OpenChat visible until the download finishes.",
                    )}
                ></Translatable>
            </BodySmall>
            <BrowserImageActionModeSettings />
            {#if $webModelStatus.status === "downloading"}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            `Downloading ${$webModelStatus.name}… ` +
                                ($webModelStatus.progress !== undefined
                                    ? `${Math.round(($webModelStatus.progress.received / Math.max(1, $webModelStatus.progress.total)) * 100)}%`
                                    : ""),
                        )}
                    ></Translatable>
                </BodySmall>
                <Button width={"hug"} secondary onClick={cancelWebModelDownload}>
                    <Translatable resourceKey={i18nKey("Cancel download")}></Translatable>
                </Button>
            {:else if $webModelStatus.status === "verifying"}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            `Checking ${$webModelStatus.name} against its SHA-256…`,
                        )}
                    ></Translatable>
                </BodySmall>
            {:else}
                {#each webChoices as entry, i (entry.id)}
                    <Container gap={"xs"} direction={"vertical"}>
                        <Container
                            gap={"sm"}
                            direction={"horizontal"}
                            crossAxisAlignment={"center"}
                        >
                            <BodySmall fontWeight={"bold"}>
                                <Translatable
                                    resourceKey={i18nKey(
                                        `${entry.name} (${formatSize(entry.sizeBytes)})`,
                                    )}
                                ></Translatable>
                            </BodySmall>
                            {#if entry.modalities.includes("image")}
                                <Chip>
                                    <Translatable resourceKey={i18nKey("reads images")}
                                    ></Translatable>
                                </Chip>
                            {/if}
                            {#if transformersWebGpuModelSpec(entry.id)?.optionalAudio !== undefined}
                                <Chip>
                                    <Translatable resourceKey={i18nKey("voice add-on optional")}
                                    ></Translatable>
                                </Chip>
                            {/if}
                            {#if currentWebId === entry.id}
                                <Chip>
                                    <Translatable resourceKey={i18nKey("Current")}></Translatable>
                                </Chip>
                            {:else if $webModelInstallStatus[entry.id] === "downloaded"}
                                <Chip>
                                    <Translatable resourceKey={i18nKey("Downloaded")}
                                    ></Translatable>
                                </Chip>
                            {/if}
                        </Container>
                        {#if currentWebId === entry.id}
                            <Caption colour={"textSecondary"}>
                                <Translatable resourceKey={i18nKey(webStatusText)}></Translatable>
                            </Caption>
                            <Button width={"hug"} secondary onClick={detachWebModel}>
                                <Translatable resourceKey={i18nKey("Remove model")}></Translatable>
                            </Button>
                        {:else}
                            {#if entry.description !== undefined}
                                <Caption colour={"textSecondary"}>
                                    <Translatable resourceKey={i18nKey(entry.description)}
                                    ></Translatable>
                                </Caption>
                            {/if}
                            <Button
                                width={"hug"}
                                secondary={webActive || i !== 0}
                                disabled={$webModelInstallStatus[entry.id] === "checking"}
                                onClick={() => chooseWebModel(entry)}
                            >
                                <Translatable
                                    resourceKey={i18nKey(
                                        webErrorModelId === entry.id ||
                                            ($webModelStatus.status === "error" &&
                                                $webModelStatus.id === entry.id)
                                            ? "Retry download"
                                            : $webModelInstallStatus[entry.id] === "checking"
                                              ? "Checking download"
                                              : $webModelInstallStatus[entry.id] === "downloaded"
                                                ? "Use this model"
                                                : i === 0
                                                  ? "Download & use (default)"
                                                  : "Download & use",
                                    )}
                                ></Translatable>
                            </Button>
                        {/if}
                    </Container>
                {/each}
            {/if}
            {#if $webModelStatus.status === "error"}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            `Model failed to load: ${$webModelStatus.error ?? "unknown error"}`,
                        )}
                    ></Translatable>
                </BodySmall>
            {/if}
            {#if webError !== ""}
                <BodySmall>
                    <Translatable resourceKey={i18nKey(webError)}></Translatable>
                </BodySmall>
            {/if}
            <WebGpuModelCatalogSettings busy={webRuntimeSettingsBusy} />
            {#if currentWebId !== undefined && transformersWebGpuSelectionCanHandle(currentWebId) && $webModelStatus.name !== undefined}
                <WebInferenceRuntimeSettings
                    context="phone"
                    modelId={currentWebId}
                    modelName={$webModelStatus.name}
                    busy={webRuntimeSettingsBusy}
                />
            {/if}
        {:else}
            <H2 fontWeight={"bold"} colour={"primary"}>
                <Translatable resourceKey={i18nKey("Available models")}></Translatable>
            </H2>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Models run entirely on your device — nothing you ask them is sent to a server. Downloads are large; use Wi-Fi.",
                    )}
                ></Translatable>
            </BodySmall>

            {#if !showAdd}
                <Button secondary onClick={() => (showAdd = true)}>
                    <Translatable resourceKey={i18nKey("+ Add a model from URL")}></Translatable>
                </Button>
            {:else}
                <Container gap={"sm"} direction={"vertical"}>
                    <Caption colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Paste a direct link to a .gguf model file — opening it should start a download, not show a web page (e.g. https://huggingface.co/<org>/<repo>/resolve/main/<file>.gguf). It must be publicly downloadable; login/token-gated models won't work.",
                            )}
                        ></Translatable>
                    </Caption>
                    <Input bind:value={addUrl} placeholder={"Model URL (.gguf)"} />
                    <Input
                        bind:value={addMmprojUrl}
                        placeholder={"Vision projector URL (optional — enables image input)"}
                    />
                    <Input bind:value={addName} placeholder={"Name (optional)"} />
                    <Container gap={"sm"} direction={"horizontal"}>
                        <Button onClick={checkModel} disabled={checking || addUrl.trim() === ""}>
                            <Translatable resourceKey={i18nKey(checking ? "Checking…" : "Check")}
                            ></Translatable>
                        </Button>
                        <Button secondary onClick={resetAdd}>
                            <Translatable resourceKey={i18nKey("Cancel")}></Translatable>
                        </Button>
                    </Container>

                    {#if checkFresh}
                        <Container gap={"sm"} direction={"vertical"}>
                            {#each warnings as w (w.code)}
                                <Caption
                                    colour={w.level === "blocker"
                                        ? "validationError"
                                        : "textSecondary"}
                                >
                                    {w.level === "blocker" ? "⛔" : "⚠️"}
                                    {w.message}
                                </Caption>
                            {/each}
                        </Container>
                        <Button disabled={hasBlocker(warnings)} onClick={addAndDownload}>
                            <Translatable resourceKey={i18nKey("Add & Download")}></Translatable>
                        </Button>
                        {#if hasBlocker(warnings)}
                            <Caption colour={"validationError"}>
                                <Translatable
                                    resourceKey={i18nKey(
                                        "Resolve the items marked ⛔ above before this model can be added.",
                                    )}
                                ></Translatable>
                            </Caption>
                        {/if}
                    {/if}

                    {#if addError}
                        <Caption colour={"validationError"}>{addError}</Caption>
                    {/if}
                </Container>
            {/if}

            {#each display as entry (entry.id)}
                {@const install = installStatus(entry)}
                {@const downloaded = install === "current"}
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
                        {#if entry.custom}
                            <Chip
                                ><Translatable resourceKey={i18nKey("Custom")}></Translatable></Chip
                            >
                        {/if}
                        <Caption colour={"textSecondary"}>{formatSize(entry.sizeBytes)}</Caption>
                    </Container>
                    {#if entry.custom && entry.sourceUrl}
                        <Caption colour={"textSecondary"}>{entry.sourceUrl}</Caption>
                    {/if}
                    {#if install === "update_required"}
                        <Caption colour={"validationError"}>
                            <Translatable
                                resourceKey={i18nKey(
                                    "Update required — this downloaded model does not match the version trusted by this OpenChat build.",
                                )}
                            ></Translatable>
                        </Caption>
                    {/if}

                    {#if downloaded}
                        <Container gap={"sm"} direction={"horizontal"}>
                            <Button
                                disabled={selected === entry.id}
                                onClick={() => select(entry.id)}
                            >
                                <Translatable
                                    resourceKey={i18nKey(
                                        selected === entry.id ? "Selected" : "Select",
                                    )}
                                ></Translatable>
                            </Button>
                            <Button secondary onClick={() => remove(entry)}>
                                <Translatable resourceKey={i18nKey("Remove")}></Translatable>
                            </Button>
                        </Container>
                    {:else if busy}
                        <div class="progress-track">
                            <div class="progress-fill" style={`width:${percent(entry.id)}%`}></div>
                        </div>
                        <Caption colour={"textSecondary"}>
                            {percent(entry.id)}% · {formatSize(progress[entry.id]?.received ?? 0)} / {formatSize(
                                progress[entry.id]?.total || entry.sizeBytes,
                            )}
                        </Caption>
                    {:else}
                        <Caption colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("License:")}></Translatable>
                            {" "}
                            {#if entry.licenseUrl}
                                <a href={entry.licenseUrl} target="_blank" rel="noopener noreferrer"
                                    >{entry.license}</a
                                >
                            {:else}
                                {entry.license}
                            {/if}
                        </Caption>
                        <Switch
                            bound={false}
                            checked={accepted[entry.id] === true}
                            onChange={() =>
                                (accepted = {
                                    ...accepted,
                                    [entry.id]: accepted[entry.id] !== true,
                                })}
                        >
                            <Caption>
                                <Translatable
                                    resourceKey={i18nKey("I have read and accept the license")}
                                ></Translatable>
                            </Caption>
                        </Switch>
                        <Container
                            gap={"sm"}
                            direction={"horizontal"}
                            crossAxisAlignment={"center"}
                        >
                            <Button
                                disabled={accepted[entry.id] !== true}
                                onClick={() => download(entry)}
                            >
                                <Translatable
                                    resourceKey={i18nKey(
                                        install === "update_required" ? "Update" : "Download",
                                    )}
                                ></Translatable>
                            </Button>
                            {#if install === "update_required"}
                                <Button secondary onClick={() => remove(entry)}>
                                    <Translatable resourceKey={i18nKey("Remove")}></Translatable>
                                </Button>
                            {/if}
                        </Container>
                        {#if errors[entry.id]}
                            <Caption colour={"validationError"}>{errors[entry.id]}</Caption>
                        {/if}
                    {/if}
                </Container>
            {/each}

            {#if loading}
                <BodySmall
                    ><Translatable resourceKey={i18nKey("Loading…")}></Translatable></BodySmall
                >
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
