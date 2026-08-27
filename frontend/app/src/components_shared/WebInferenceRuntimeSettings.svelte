<script lang="ts">
    import {
        resetTransformersWebGpuMaxOutputTokens,
        TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS,
        TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT,
        transformersWebGpuMaxOutputTokens,
        updateTransformersWebGpuMaxOutputTokens,
    } from "../stores/transformersWebGpuSettings";
    import { transformersWebGpuSelectionCanHandle } from "../utils/transformersWebGpuInference";

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
    let savedMessage = $state("");

    function saveMaxOutputTokens(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        updateTransformersWebGpuMaxOutputTokens(input.valueAsNumber);
        savedMessage = "Max output token cap saved. The next image action uses it.";
    }

    function reset() {
        resetTransformersWebGpuMaxOutputTokens();
        savedMessage = "The 96-token output cap was restored.";
    }
</script>

{#if active}
    <section class="runtime-settings" aria-label={`${modelName} runtime settings`}>
        <h4>All-WebGPU image runtime</h4>
        <p>
            Qwen3-VL 2B runs embeddings, vision, and decoding on WebGPU. This route does not invoke
            OCR and has no CPU/WASM model fallback.
        </p>
        <dl>
            <div>
                <dt>Embeddings</dt>
                <dd><code>embed_tokens · webgpu · q4</code></dd>
            </div>
            <div>
                <dt>Vision</dt>
                <dd><code>vision_encoder · webgpu · q4</code></dd>
            </div>
            <div>
                <dt>Decoder</dt>
                <dd><code>decoder_model_merged · webgpu · q4</code></dd>
            </div>
            <div>
                <dt>Image input</dt>
                <dd><code>256 × 448 · normalized</code></dd>
            </div>
            <div>
                <dt>Decoding</dt>
                <dd><code>greedy · do_sample=false</code></dd>
            </div>
            <div>
                <dt>Lifecycle</dt>
                <dd><code>one job per worker · release after result</code></dd>
            </div>
        </dl>

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
    }
</style>
