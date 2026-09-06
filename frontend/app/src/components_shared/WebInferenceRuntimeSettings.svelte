<script lang="ts">
    import {
        deleteTransformersWebGpuAudio,
        preloadTransformersWebGpuAudio,
        transformersWebGpuSelectionCanHandle,
        transformersWebGpuAudioDownloaded,
    } from "../utils/transformersWebGpuInference";
    import {
        PHONE_GEMMA4_E2B_MODEL_ID,
        transformersWebGpuModelSpec,
    } from "../utils/transformersWebGpuProtocol";
    import {
        resetTransformersWebGpuMaxOutputTokens,
        TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS,
        TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT,
        transformersWebGpuMaxOutputTokens,
        updateTransformersWebGpuMaxOutputTokens,
    } from "../stores/transformersWebGpuSettings";
    import { onDestroy } from "svelte";

    let {
        modelId,
        modelName,
        busy = false,
    } = $props<{
        context: "desktop" | "phone";
        modelId: string;
        modelName: string;
        busy?: boolean;
    }>();

    let active = $derived(transformersWebGpuSelectionCanHandle(modelId));
    let modelSpec = $derived(transformersWebGpuModelSpec(modelId));
    let audioInstalled = $state(false);
    let audioChecking = $state(false);
    let audioBusy = $state(false);
    let audioProgress = $state<{ received: number; total: number } | undefined>(undefined);
    let audioMessage = $state("");
    let audioGeneration = 0;
    let audioController: AbortController | undefined;
    let destroyed = false;
    let savedMessage = $state("");

    function invalidateAudioOperation() {
        audioGeneration += 1;
        audioController?.abort();
        audioController = undefined;
    }

    function audioOperationCurrent(targetModelId: string, generation: number) {
        return !destroyed && modelId === targetModelId && generation === audioGeneration;
    }

    async function refreshAudioState(targetModelId: string, generation = audioGeneration) {
        if (transformersWebGpuModelSpec(targetModelId)?.optionalAudio === undefined) {
            audioInstalled = false;
            audioChecking = false;
            audioMessage = "";
            return;
        }
        audioChecking = true;
        audioMessage = "";
        try {
            const installed = await transformersWebGpuAudioDownloaded(targetModelId);
            if (audioOperationCurrent(targetModelId, generation)) audioInstalled = installed;
        } catch (error) {
            if (audioOperationCurrent(targetModelId, generation)) {
                audioInstalled = false;
                audioMessage = error instanceof Error ? error.message : String(error);
            }
        } finally {
            if (audioOperationCurrent(targetModelId, generation)) audioChecking = false;
        }
    }

    $effect(() => {
        const targetModelId = modelId;
        invalidateAudioOperation();
        audioInstalled = false;
        audioBusy = false;
        audioProgress = undefined;
        audioMessage = "";
        void refreshAudioState(targetModelId);
        return invalidateAudioOperation;
    });

    async function installAudio() {
        invalidateAudioOperation();
        const targetModelId = modelId;
        const generation = audioGeneration;
        const controller = new AbortController();
        audioController = controller;
        audioBusy = true;
        audioMessage = "";
        audioProgress = {
            received: 0,
            total: modelSpec?.optionalAudio?.artifactBytes ?? 0,
        };
        try {
            await preloadTransformersWebGpuAudio(targetModelId, {
                signal: controller.signal,
                onProgress(received, total) {
                    if (audioOperationCurrent(targetModelId, generation)) {
                        audioProgress = { received, total };
                    }
                },
            });
            if (!audioOperationCurrent(targetModelId, generation)) return;
            const installed = await transformersWebGpuAudioDownloaded(targetModelId);
            if (!audioOperationCurrent(targetModelId, generation)) return;
            audioInstalled = installed;
            if (!audioInstalled) throw new Error("The voice add-on could not be verified.");
            audioMessage = "Voice-message support installed.";
        } catch (error) {
            if (audioOperationCurrent(targetModelId, generation) && !controller.signal.aborted) {
                audioMessage = error instanceof Error ? error.message : String(error);
            }
        } finally {
            if (audioOperationCurrent(targetModelId, generation)) {
                audioBusy = false;
                audioProgress = undefined;
                audioController = undefined;
            }
        }
    }

    async function removeAudio() {
        invalidateAudioOperation();
        const targetModelId = modelId;
        const generation = audioGeneration;
        audioBusy = true;
        audioMessage = "";
        try {
            await deleteTransformersWebGpuAudio(targetModelId);
            if (!audioOperationCurrent(targetModelId, generation)) return;
            audioInstalled = false;
            audioMessage =
                "Voice-message support removed. Text and image support remain installed.";
        } catch (error) {
            if (!audioOperationCurrent(targetModelId, generation)) return;
            const message = error instanceof Error ? error.message : String(error);
            // CacheStorage deletion can fail before or after removing one of the add-on files.
            // Re-read the target so the control never claims a retained or partial add-on is gone.
            await refreshAudioState(targetModelId, generation);
            if (audioOperationCurrent(targetModelId, generation)) audioMessage = message;
        } finally {
            if (audioOperationCurrent(targetModelId, generation)) audioBusy = false;
        }
    }

    onDestroy(() => {
        destroyed = true;
        invalidateAudioOperation();
    });

    function saveMaxOutputTokens(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        updateTransformersWebGpuMaxOutputTokens(input.valueAsNumber);
        savedMessage = "Max output token cap saved. The next local model run uses it.";
    }

    function reset() {
        resetTransformersWebGpuMaxOutputTokens();
        savedMessage = "The 96-token output cap was restored.";
    }
</script>

{#if active}
    <section class="runtime-settings" aria-label={`${modelName} runtime settings`}>
        <h4>All-WebGPU model runtime</h4>
        <p>
            {modelSpec?.name ?? modelName} runs embeddings, vision, and decoding on WebGPU. This route
            does not invoke OCR and has no CPU/WASM model fallback.
        </p>
        <dl>
            <div>
                <dt>Embeddings</dt>
                <dd><code>embed_tokens · webgpu · {modelSpec?.dtype ?? "q4"}</code></dd>
            </div>
            <div>
                <dt>Vision</dt>
                <dd><code>vision_encoder · webgpu · {modelSpec?.dtype ?? "q4"}</code></dd>
            </div>
            <div>
                <dt>Decoder</dt>
                <dd><code>decoder_model_merged · webgpu · {modelSpec?.dtype ?? "q4"}</code></dd>
            </div>
            {#if modelId !== PHONE_GEMMA4_E2B_MODEL_ID}
                <div>
                    <dt>Image input</dt>
                    <dd><code>288 × 512 · normalized</code></dd>
                </div>
            {/if}
            <div>
                <dt>Decoding</dt>
                <dd><code>greedy · do_sample=false</code></dd>
            </div>
            <div>
                <dt>Lifecycle</dt>
                <dd><code>one job per worker · release after result</code></dd>
            </div>
        </dl>

        {#if modelSpec?.optionalAudio !== undefined}
            <div class="audio-addon">
                <div>
                    <strong>Voice-message support (optional)</strong>
                    <p class="hint">
                        Separate {Math.round(modelSpec.optionalAudio.artifactBytes / 1024 / 1024)} MB
                        download. Gemma text and image inference works without it.
                    </p>
                </div>
                {#if audioChecking}
                    <p class="hint" role="status">Checking voice add-on…</p>
                {:else if audioInstalled}
                    <button type="button" disabled={busy || audioBusy} onclick={removeAudio}>
                        Remove voice support
                    </button>
                {:else}
                    <button type="button" disabled={busy || audioBusy} onclick={installAudio}>
                        {audioBusy ? "Downloading voice support…" : "Install voice support"}
                    </button>
                {/if}
                {#if audioProgress !== undefined && audioProgress.total > 0}
                    <progress value={audioProgress.received} max={audioProgress.total}></progress>
                    <p class="hint" role="status">
                        {Math.round((audioProgress.received / audioProgress.total) * 100)}%
                    </p>
                {/if}
                {#if audioMessage !== ""}
                    <p class="saved" role="status">{audioMessage}</p>
                {/if}
            </div>
        {/if}

        <label>
            <span>Maximum output tokens</span>
            <input
                type="number"
                min={TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS.min}
                max={TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS.max}
                step="1"
                value={$transformersWebGpuMaxOutputTokens}
                disabled={busy}
                onchange={saveMaxOutputTokens}
            />
        </label>
        <p class="hint">
            Range {TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS.min}–{TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS.max};
            default {TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT}. Temperature, top-p, and top-k
            are inactive because sampling is disabled.
        </p>
        <button type="button" disabled={busy} onclick={reset}>Restore default</button>
        {#if savedMessage !== ""}
            <p class="saved" role="status">{savedMessage}</p>
        {/if}
    </section>
{/if}

<style lang="scss">
    .runtime-settings {
        display: flex;
        flex-direction: column;
        gap: var(--oc-gap-2, 8px);
        margin: 12px 0;
        padding: 12px;
        border: 1px solid var(--oc-border, rgba(127, 127, 127, 0.3));
        border-radius: 10px;

        h4,
        p,
        dl {
            margin: 0;
        }

        dl {
            display: grid;
            gap: 4px;
        }

        dl > div,
        label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        dt,
        label span {
            font-weight: 600;
        }

        dd {
            margin: 0;
            text-align: right;
        }

        input {
            width: 84px;
        }

        button {
            align-self: flex-start;
        }

        .hint,
        .saved {
            font-size: 0.875rem;
        }

        .audio-addon {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding-block: 8px;
            border-block: 1px solid var(--oc-border, rgba(127, 127, 127, 0.3));
        }

        progress {
            width: 100%;
        }
    }
</style>
