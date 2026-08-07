<script lang="ts">
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
    import { defaultModelCatalog, mergeCatalogs, webEligibleModels } from "@utils/modelCatalog";
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
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "../../Translatable.svelte";

    // On-device inference runs wherever the Tauri native bridge is present (desktop + mobile); degrade
    // gracefully in the plain web/PWA build. The catalog is data; nothing is bundled.
    const client = getContext<OpenChat>("client");
    const native = isNativeClient();

    // The OpenChat-hosted catalog (owner-curated on the registry, updatable without a client release)
    // is a per-id OVERLAY on the built-in default — remote entries rank first and win on id conflicts,
    // builtin leftovers are appended — so a stale/partial remote catalog can never shrink the chooser.
    let catalogSource = $state<ModelCatalogEntry[]>(defaultModelCatalog.models);

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

    // ── Browser (non-native) model-from-disk state ────────────────────────────────────────────
    // A GGUF picked from a NORMAL DISK LOCATION runs in the browser via llama.cpp-WASM (see
    // webInference.ts). The picker path persists across sessions; the file input is session-only.
    let webError = $state("");
    const hasPicker = typeof window !== "undefined" && "showOpenFilePicker" in window;

    // Catalog models a BROWSER can run: one GGUF, plus an mmproj projector for the vision entries,
    // within the ~2 GB total envelope. Catalog order IS the recommendation order — index 0 is the
    // default suggestion (rendered below as the primary "Download & use (default)" button), and it
    // is a vision model because that one measured best at text as well. Nothing here hardcodes an
    // id: reordering the catalog moves the default.
    let webChoices = $derived(webEligibleModels(catalogSource));

    // The chooser list ALWAYS renders (except mid-download); when a model is active the current one
    // is marked "Current" (matched by catalog id — disk-picked files have no id and render as an
    // extra current row above the list instead).
    let webActive = $derived(
        $webModelStatus.status === "attached" ||
            $webModelStatus.status === "loading" ||
            $webModelStatus.status === "loaded",
    );
    let currentWebId = $derived(webActive ? $webModelStatus.id : undefined);
    let webDiskAttached = $derived(webActive && $webModelStatus.id === undefined);
    let webStatusText = $derived(
        $webModelStatus.status === "loading"
            ? "loading into memory…"
            : $webModelStatus.status === "loaded"
              ? "loaded"
              : "attached — loads on first use",
    );

    // The whole entry goes down: webInference splits weights from the mmproj projector, downloads
    // both (one progress bar over the pair) and checks each against its catalog SHA-256.
    async function chooseWebModel(entry: ModelCatalogEntry) {
        webError = "";
        webError =
            (await useWebModelFromUrl({
                id: entry.id,
                name: entry.name,
                files: entry.files,
                sizeBytes: entry.sizeBytes,
                modalities: entry.modalities,
            })) ?? "";
    }

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
        if (native) {
            unlisten = await onModelDownloadProgress((p) => {
                progress = {
                    ...progress,
                    [p.modelId]: { received: p.receivedBytes, total: p.totalBytes },
                };
            });
        } else {
            // Re-attach a previously picked disk model (persisted FileSystemFileHandle).
            void restoreWebModel();
        }
    });

    onDestroy(() => unlisten?.());
</script>

{#if !native}
    <p class="blurb">
        <Translatable
            resourceKey={i18nKey(
                "Run a local model in this browser: download one below, or pick a .gguf file from your disk (up to ~2 GB — a ≤2B parameter model at Q4 works well). " +
                    "A disk file is read in place — nothing is uploaded or copied. One model is active at a time; choosing another replaces it. " +
                    "Only a model marked “reads images” can extract from a photo or a receipt.",
            )}
        />
    </p>

    <div class="web-model">
        {#if $webModelStatus.status === "none" && $webModelStatus.name !== undefined}
            <p class="hint">
                <Translatable
                    resourceKey={i18nKey(
                        `Previously attached: ${$webModelStatus.name} — re-attach to grant file access for this session.`,
                    )}
                />
            </p>
        {/if}
        {#if $webModelStatus.status === "downloading"}
            <p>
                <Translatable
                    resourceKey={i18nKey(
                        `Downloading ${$webModelStatus.name}… ` +
                            ($webModelStatus.progress !== undefined
                                ? `${Math.round(($webModelStatus.progress.received / Math.max(1, $webModelStatus.progress.total)) * 100)}%`
                                : ""),
                    )}
                />
            </p>
        {:else if $webModelStatus.status === "verifying"}
            <p>
                <Translatable
                    resourceKey={i18nKey(`Checking ${$webModelStatus.name} against its SHA-256…`)}
                />
            </p>
        {:else}
            <div class="web-choices">
                {#if webDiskAttached}
                    <div class="web-choice">
                        <div class="title">
                            <span class="name">{$webModelStatus.name}</span>
                            <span class="chip">
                                <Translatable resourceKey={i18nKey("Current")} />
                            </span>
                        </div>
                        <div class="desc">
                            <Translatable resourceKey={i18nKey(webStatusText)} />
                        </div>
                        <Button secondary small fill onClick={detachWebModel}>
                            <Translatable resourceKey={i18nKey("Remove model")} />
                        </Button>
                    </div>
                {/if}
                {#each webChoices as entry, i (entry.id)}
                    <div class="web-choice">
                        <div class="title">
                            <span class="name">{entry.name} ({formatSize(entry.sizeBytes)})</span>
                            {#if entry.modalities.includes("image")}
                                <span class="chip">
                                    <Translatable resourceKey={i18nKey("reads images")} />
                                </span>
                            {/if}
                            {#if currentWebId === entry.id}
                                <span class="chip">
                                    <Translatable resourceKey={i18nKey("Current")} />
                                </span>
                            {/if}
                        </div>
                        {#if currentWebId === entry.id}
                            <div class="desc">
                                <Translatable resourceKey={i18nKey(webStatusText)} />
                            </div>
                            <Button secondary small fill onClick={detachWebModel}>
                                <Translatable resourceKey={i18nKey("Remove model")} />
                            </Button>
                        {:else}
                            {#if entry.description !== undefined}
                                <div class="desc">{entry.description}</div>
                            {/if}
                            <Button
                                secondary={webActive || i !== 0}
                                small
                                fill
                                onClick={() => chooseWebModel(entry)}
                            >
                                <Translatable
                                    resourceKey={i18nKey(
                                        webActive
                                            ? "Use this model"
                                            : i === 0
                                              ? "Download & use (default)"
                                              : "Download & use",
                                    )}
                                />
                            </Button>
                        {/if}
                    </div>
                {/each}
            </div>
            <div class="web-attach">
                {#if hasPicker}
                    <Button secondary small onClick={attachWebPicker}>
                        <Translatable
                            resourceKey={i18nKey("Pick a .gguf from disk (remembered)")}
                        />
                    </Button>
                {/if}
                <label class="file-label">
                    <input
                        class="web-model-file"
                        type="file"
                        accept=".gguf"
                        onchange={attachWebFile}
                    />
                </label>
            </div>
        {/if}
        {#if $webModelStatus.status === "error"}
            <p class="error">
                <Translatable
                    resourceKey={i18nKey(
                        `Model failed to load: ${$webModelStatus.error ?? "unknown error"}`,
                    )}
                />
            </p>
        {/if}
        {#if webError !== ""}
            <p class="error"><Translatable resourceKey={i18nKey(webError)} /></p>
        {/if}
    </div>
{:else}
    <p class="blurb">
        <Translatable
            resourceKey={i18nKey(
                "Models run entirely on your device — nothing you ask them is sent to a server. Downloads are large; use Wi-Fi.",
            )}
        />
    </p>

    <div class="add">
        {#if !showAdd}
            <Button secondary small onClick={() => (showAdd = true)}>
                <Translatable resourceKey={i18nKey("+ Add a model from URL")} />
            </Button>
        {:else}
            <div class="add-form">
                <p class="hint">
                    <Translatable
                        resourceKey={i18nKey(
                            "Paste a direct link to a .gguf model file — opening it should start a download, not show a web page (e.g. https://huggingface.co/<org>/<repo>/resolve/main/<file>.gguf). It must be publicly downloadable; login/token-gated models won't work.",
                        )}
                    />
                </p>
                <Input bind:value={addUrl} placeholder={i18nKey("Model URL (.gguf)")} />
                <Input
                    bind:value={addMmprojUrl}
                    placeholder={i18nKey("Vision projector URL (optional — enables image input)")}
                />
                <Input bind:value={addName} placeholder={i18nKey("Name (optional)")} />
                <div class="actions">
                    <Button small onClick={checkModel} disabled={checking || addUrl.trim() === ""}>
                        <Translatable resourceKey={i18nKey(checking ? "Checking…" : "Check")} />
                    </Button>
                    <Button secondary small onClick={resetAdd}>
                        <Translatable resourceKey={i18nKey("Cancel")} />
                    </Button>
                </div>

                {#if checkFresh}
                    <div class="warnings">
                        {#each warnings as w (w.code)}
                            <div class="warning {w.level}">
                                <span class="icon">{w.level === "blocker" ? "⛔" : "⚠️"}</span>
                                <span>{w.message}</span>
                            </div>
                        {/each}
                    </div>
                    <div class="actions">
                        <Button small disabled={hasBlocker(warnings)} onClick={addAndDownload}>
                            <Translatable resourceKey={i18nKey("Add & Download")} />
                        </Button>
                    </div>
                    {#if hasBlocker(warnings)}
                        <p class="blocked-note">
                            <Translatable
                                resourceKey={i18nKey(
                                    "Resolve the items marked ⛔ above before this model can be added.",
                                )}
                            />
                        </p>
                    {/if}
                {/if}

                {#if addError}
                    <div class="error">{addError}</div>
                {/if}
            </div>
        {/if}
    </div>

    {#each display as entry (entry.id)}
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
                {#if entry.custom}
                    <span class="chip custom">
                        <Translatable resourceKey={i18nKey("Custom")} />
                    </span>
                {/if}
                <span class="size">{formatSize(entry.sizeBytes)}</span>
            </div>
            {#if entry.custom && entry.sourceUrl}
                <div class="source" title={entry.sourceUrl}>{entry.sourceUrl}</div>
            {/if}

            {#if downloaded}
                <div class="actions">
                    <Button disabled={selected === entry.id} onClick={() => select(entry.id)} small>
                        <Translatable
                            resourceKey={i18nKey(selected === entry.id ? "Selected" : "Select")}
                        />
                    </Button>
                    <Button secondary onClick={() => remove(entry)} small>
                        <Translatable resourceKey={i18nKey("Remove")} />
                    </Button>
                </div>
            {:else if busy}
                <div class="progress-track">
                    <div class="progress-fill" style={`width:${percent(entry.id)}%`}></div>
                </div>
                <div class="size">
                    {percent(entry.id)}% · {formatSize(progress[entry.id]?.received ?? 0)} / {formatSize(
                        progress[entry.id]?.total || entry.sizeBytes,
                    )}
                </div>
            {:else}
                <div class="size">
                    <Translatable resourceKey={i18nKey("License:")} />
                    {" "}
                    {#if entry.licenseUrl}
                        <a href={entry.licenseUrl} target="_blank" rel="noopener noreferrer"
                            >{entry.license}</a
                        >
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
                    label={i18nKey("I have read and accept the license")}
                />
                <div class="actions">
                    <Button
                        disabled={accepted[entry.id] !== true}
                        onClick={() => download(entry)}
                        small
                    >
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
    // Layout ported from the v2 tree (components_mobile/.../ModelManager.svelte) so the two model
    // choosers read the same. v2 composes it from component-lib Containers; v1 has no component-lib,
    // so the STRUCTURE is reproduced with v1 primitives and the spacing scale is matched token for
    // token — component-lib's xs/sm/lg are 4/8/16px, which are exactly $sp2/$sp3/$sp4 here (see the
    // `// xs` / `// sm` annotations in styles/mixins.scss).
    //
    // Four things define the v2 shape, all of which v1 got wrong before:
    //   1. each entry is a VERTICAL card — title row, description, then a FULL-WIDTH button — not a
    //      horizontal row with the button floated right (that squeezed it into a ~90px column, so
    //      "Use this model" wrapped onto three lines);
    //   2. the size lives INSIDE the bold title, not in a separate muted span;
    //   3. chips sit at the RIGHT EDGE of the title row (v2's title takes width:"fill", pushing
    //      them out), not inline after the name where they broke mid-phrase;
    //   4. chips are neutral outlines in both states — v2 does not colour-code "Current", because
    //      its right-edge position is what makes it scannable.
    .web-model {
        display: flex;
        flex-direction: column;
        gap: $sp3; // v2: Container gap "sm"
        margin: $sp3 0 $sp4;
    }
    .web-choices {
        display: flex;
        flex-direction: column;
        gap: $sp4; // v2: the outer Container's gap "lg" between entries
    }
    .web-choice {
        display: flex;
        flex-direction: column;
        gap: $sp2; // v2: per-entry Container gap "xs"
    }
    .web-choice .title {
        display: flex;
        align-items: center;
        gap: $sp3; // v2: title-row Container gap "sm", crossAxisAlignment "center"
    }
    .web-choice .name {
        @include font(bold, normal, fs-90);
        flex: 1 1 auto; // v2: BodySmall width="fill" — this is what pushes the chips right
        min-width: 0;
    }
    .web-choice .desc {
        @include font-size(fs-80);
        color: var(--txt-light);
    }
    .web-attach {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        margin-top: $sp2;
    }

    .blurb {
        @include font-size(fs-80);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
    .add {
        margin-bottom: $sp4;
    }
    .add-form {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp4 0;
    }
    .hint {
        @include font-size(fs-70);
        color: var(--txt-light);
        word-break: break-word;
    }
    .warnings {
        display: flex;
        flex-direction: column;
        gap: $sp2;
    }
    .warning {
        display: flex;
        gap: $sp2;
        align-items: flex-start;
        @include font-size(fs-70);

        .icon {
            flex: 0 0 auto;
        }
        &.blocker {
            color: var(--error);
        }
        &.caution {
            color: var(--txt-light);
        }
    }
    .blocked-note {
        @include font-size(fs-60);
        color: var(--error);
    }
    // The NATIVE download list was already v2-shaped (vertical card, actions on their own row); only
    // the internal gap differed — v2 uses "sm" (8px) here, not "xs".
    .model {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp4 0;
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
    // v2's component-lib <Chip> in its "default" mode: transparent fill, a 2px border in a muted
    // colour, muted label, md radius. "Custom" keeps the accent fill (component-lib's "filled"
    // mode) — it flags a user-supplied, unverified model, which is a warning, not a status.
    .chip {
        @include font-size(fs-60);
        white-space: nowrap; // never break "reads images" across two lines
        flex: 0 0 auto;
        padding: 2px $sp3;
        border-radius: $sp3;
        border: 2px solid var(--bd);
        background-color: transparent;
        color: var(--txt-light);

        &.custom {
            border-color: var(--accent);
            background-color: var(--accent);
            color: #fff;
        }
    }
    .source {
        @include font-size(fs-60);
        color: var(--txt-light);
        word-break: break-all;
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
