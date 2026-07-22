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
    import { defaultModelCatalog } from "@utils/modelCatalog";
    import { isNativeClient } from "@utils/onDeviceInference";
    import {
        clearWebModel,
        pickWebModelFromDisk,
        restoreWebModel,
        setWebModelFile,
        useWebModelFromUrl,
        webModelStatus,
    } from "@utils/webInference";
    import {
        assessSuitability,
        hasBlocker,
        type SuitabilityWarning,
        type UrlProbe,
    } from "@utils/modelSuitability";
    import { BodySmall, Button, Caption, Chip, Container, H2, Input, Switch } from "component-lib";
    import type { ModelCatalogEntry, ModelModality } from "openchat-shared";
    import type { OpenChat } from "openchat-client";
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
    import SlidingPageContent from "../SlidingPageContent.svelte";

    // On-device inference runs wherever the Tauri native bridge is present (desktop + mobile); degrade
    // gracefully in the plain web/PWA build.
    const client = getContext<OpenChat>("client");
    const native = isNativeClient();

    // Browser model-from-disk (llama.cpp-WASM over a GGUF read in place from disk — webInference.ts).
    let webError = $state("");
    const hasPicker = typeof window !== "undefined" && "showOpenFilePicker" in window;
    async function attachWebFile(e: Event) {
        webError = "";
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file === undefined) return;
        webError = (await setWebModelFile(file)) ?? "";
        input.value = "";
    }
    async function attachWebPicker() {
        webError = "";
        webError = (await pickWebModelFromDisk()) ?? "";
    }
    async function detachWebModel() {
        webError = "";
        await clearWebModel();
    }

    // Prefer the OpenChat-hosted catalog (owner-curated on the registry, updatable without a client
    // release); fall back to the built-in default when it's empty (not configured) or unreachable.
    let catalogSource = $state<ModelCatalogEntry[]>(defaultModelCatalog.models);

    // Catalog models a BROWSER can run: a single GGUF within the ~2 GB wasm32 envelope. Catalog
    // order is the recommendation order (Gemma first = the default suggestion).
    const WEB_MODEL_MAX = 2_147_483_648;
    let webChoices = $derived(
        catalogSource.filter((m) => m.files.length === 1 && m.sizeBytes <= WEB_MODEL_MAX),
    );

    async function chooseWebModel(entry: ModelCatalogEntry) {
        webError = "";
        webError =
            (await useWebModelFromUrl({
                id: entry.id,
                name: entry.name,
                url: entry.files[0].url,
                sizeBytes: entry.sizeBytes,
            })) ?? "";
    }

    async function loadCatalog() {
        try {
            const remote = await client.modelCatalog();
            if (remote.models.length > 0) {
                catalogSource = remote.models;
            }
        } catch {
            // keep the built-in default
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

        // Force deterministic on-disk names so the native runtime classifies the files correctly: the
        // language model as "model.gguf" (find_gguf) and the projector as "mmproj.gguf" (find_mmproj),
        // regardless of what the source URLs are named.
        const files: CustomModelFile[] = [
            { url, bytes: primaryProbe?.contentLength ?? 0, filename: "model.gguf" },
        ];
        if (mmproj !== "") {
            files.push({
                url: mmproj,
                bytes: mmprojProbe?.contentLength ?? 0,
                filename: "mmproj.gguf",
            });
        }
        const modalities: ModelModality[] = mmproj !== "" ? ["text", "image"] : ["text"];
        const name = addName.trim() !== "" ? addName.trim() : fileNameFromUrl(url) || "Custom model";
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
        if (!native) void restoreWebModel();
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
                        "Run a local model in this browser: pick a .gguf file from your disk (up to ~2 GB — a ≤2B parameter model at Q4 works well). The file is read in place — nothing is uploaded or copied. Text extraction only; image understanding needs the desktop or mobile app.",
                    )}></Translatable>
            </BodySmall>
            {#if $webModelStatus.status === "attached" || $webModelStatus.status === "loaded" || $webModelStatus.status === "loading"}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            `Model: ${$webModelStatus.name}` +
                                ($webModelStatus.status === "loading"
                                    ? " (loading into memory…)"
                                    : $webModelStatus.status === "loaded"
                                      ? " (loaded)"
                                      : " (attached — loads on first use)"),
                        )}></Translatable>
                </BodySmall>
                <Button size={"sm"} secondary onClick={detachWebModel}>
                    <Translatable resourceKey={i18nKey("Remove model")}></Translatable>
                </Button>
            {:else if $webModelStatus.status === "downloading"}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            `Downloading ${$webModelStatus.name}… ` +
                                ($webModelStatus.progress !== undefined
                                    ? `${Math.round(($webModelStatus.progress.received / Math.max(1, $webModelStatus.progress.total)) * 100)}%`
                                    : ""),
                        )}></Translatable>
                </BodySmall>
            {:else}
                {#each webChoices as entry, i (entry.id)}
                    <Container gap={"xs"} direction={"vertical"}>
                        <BodySmall fontWeight={"bold"}>
                            <Translatable
                                resourceKey={i18nKey(`${entry.name} (${formatSize(entry.sizeBytes)})`)}></Translatable>
                        </BodySmall>
                        {#if entry.description !== undefined}
                            <Caption colour={"textSecondary"}>
                                <Translatable resourceKey={i18nKey(entry.description)}></Translatable>
                            </Caption>
                        {/if}
                        <Button size={"sm"} secondary={i !== 0} onClick={() => chooseWebModel(entry)}>
                            <Translatable
                                resourceKey={i18nKey(
                                    i === 0 ? "Download & use (default)" : "Download & use",
                                )}></Translatable>
                        </Button>
                    </Container>
                {/each}
                {#if hasPicker}
                    <Button size={"sm"} secondary onClick={attachWebPicker}>
                        <Translatable resourceKey={i18nKey("Pick a .gguf from disk (remembered)")}></Translatable>
                    </Button>
                {/if}
                <input class="web-model-file" type="file" accept=".gguf" onchange={attachWebFile} />
            {/if}
            {#if $webModelStatus.status === "error"}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            `Model failed to load: ${$webModelStatus.error ?? "unknown error"}`,
                        )}></Translatable>
                </BodySmall>
            {/if}
            {#if webError !== ""}
                <BodySmall>
                    <Translatable resourceKey={i18nKey(webError)}></Translatable>
                </BodySmall>
            {/if}
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
                            )}></Translatable>
                    </Caption>
                    <Input bind:value={addUrl} placeholder={"Model URL (.gguf)"} />
                    <Input
                        bind:value={addMmprojUrl}
                        placeholder={"Vision projector URL (optional — enables image input)"} />
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
                                <Caption colour={w.level === "blocker" ? "error" : "textSecondary"}>
                                    {w.level === "blocker" ? "⛔" : "⚠️"}
                                    {w.message}
                                </Caption>
                            {/each}
                        </Container>
                        <Button disabled={hasBlocker(warnings)} onClick={addAndDownload}>
                            <Translatable resourceKey={i18nKey("Add & Download")}></Translatable>
                        </Button>
                        {#if hasBlocker(warnings)}
                            <Caption colour={"error"}>
                                <Translatable
                                    resourceKey={i18nKey(
                                        "Resolve the items marked ⛔ above before this model can be added.",
                                    )}></Translatable>
                            </Caption>
                        {/if}
                    {/if}

                    {#if addError}
                        <Caption colour={"error"}>{addError}</Caption>
                    {/if}
                </Container>
            {/if}

            {#each display as entry (entry.id)}
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
                        {#if entry.custom}
                            <Chip><Translatable resourceKey={i18nKey("Custom")}></Translatable></Chip>
                        {/if}
                        <Caption colour={"textSecondary"}>{formatSize(entry.sizeBytes)}</Caption>
                    </Container>
                    {#if entry.custom && entry.sourceUrl}
                        <Caption colour={"textSecondary"}>{entry.sourceUrl}</Caption>
                    {/if}

                    {#if downloaded}
                        <Container gap={"sm"} direction={"horizontal"}>
                            <Button disabled={selected === entry.id} onClick={() => select(entry.id)}>
                                <Translatable
                                    resourceKey={i18nKey(selected === entry.id ? "Selected" : "Select")}
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
