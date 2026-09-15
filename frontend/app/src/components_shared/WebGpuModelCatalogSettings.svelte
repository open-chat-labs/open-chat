<script lang="ts">
    import { webGpuModelCatalog } from "../stores/webGpuModelCatalog";
    import {
        applyWebGpuModelCatalog,
        modelCatalogSource,
        refreshWebGpuModelCatalog,
        retainedWebGpuModelCaches,
        removeRetainedWebGpuModelCache,
        WEB_GPU_CATALOG_MAX_BYTES,
    } from "../utils/webGpuModelCatalog";
    let { busy = false }: { busy?: boolean } = $props();
    let source = $state(modelCatalogSource());
    let working = $state(false);
    let message = $state("");
    let error = $state("");
    let retained = $derived.by(() => {
        void $webGpuModelCatalog;
        return retainedWebGpuModelCaches();
    });
    async function removeCache(cacheKey: string, name: string) {
        if (
            busy ||
            working ||
            !confirm(
                `Delete the retained download for ${name}? This does not affect account or chat data.`,
            )
        )
            return;
        await run(() => removeRetainedWebGpuModelCache(cacheKey));
        if (!error) message = "The selected retained model download was removed.";
    }
    async function run(action: () => Promise<unknown>) {
        if (busy || working) return;
        working = true;
        error = "";
        message = "";
        try {
            await action();
            message = "Catalog applied. Downloaded weights were retained.";
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            working = false;
        }
    }
    async function importFile(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        await run(async () => {
            if (file.size > WEB_GPU_CATALOG_MAX_BYTES)
                throw new Error("Model catalog exceeds 512 KiB.");
            applyWebGpuModelCatalog(await file.text());
        });
        input.value = "";
    }
</script>

<details class="catalog">
    <summary>Model catalog · {$webGpuModelCatalog.version}</summary>
    <p>
        Import a trusted JSON catalog to add, remove or configure compatible WebGPU models. Catalogs
        control weight downloads and generation settings, not app prompts. Changes do not delete
        downloaded models. Existing jobs keep their original configuration.
    </p>
    <label>
        Catalog URL (HTTPS, or blank for this server)
        <input
            type="url"
            bind:value={source}
            disabled={busy || working}
            placeholder="https://your-server/model-catalog.json"
        />
    </label>
    <button disabled={busy || working} onclick={() => run(() => refreshWebGpuModelCatalog(source))}
        >Refresh catalog</button
    >
    <label>
        Import catalog JSON
        <input
            aria-label="Import model catalog JSON"
            type="file"
            accept=".json,application/json"
            disabled={busy || working}
            onchange={importFile}
        />
    </label>
    {#if error}<p role="alert">{error}</p>{/if}
    {#if message}<p role="status">{message}</p>{/if}
    {#if $webGpuModelCatalog.models.every((m) => !m.enabled)}
        <p>No models are enabled. Import or refresh a catalog to enable a model.</p>
    {/if}
    {#if retained.length > 0}
        <details>
            <summary>Disabled or previous model versions</summary>
            <p>Any downloaded files remain on this device until you explicitly remove them.</p>
            {#each retained as model (model.cacheKey)}
                <p>{model.name} · <code>{model.cacheKey}</code></p>
                <button
                    disabled={busy || working}
                    onclick={() => removeCache(model.cacheKey, model.name)}
                    >Delete retained download</button
                >
            {/each}
        </details>
    {/if}
</details>

<style>
    .catalog {
        margin-block: 1rem;
        overflow-wrap: anywhere;
    }
    label {
        display: block;
        margin-block: 0.75rem;
    }
    input {
        display: block;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
    }
    button {
        padding: 0.5rem;
    }
    [role="alert"] {
        color: var(--error-color, #b3261e);
    }
</style>
