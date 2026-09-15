# Configurable WebGPU models

The all-WebGPU model list, artifact identities and generation defaults are data in
`frontend/app/public/model-catalog.json`. Both Model Manager UI versions use the same
validated registry and catalog controls. The enabled Android WebGPU build uses the same path.

## Updating an existing installation

1. Start from the complete JSON example shipped in this repository.
2. Edit the catalog as described below; publish the JSON and any replacement artifacts.
3. In **On-device models → Model catalog**, import the JSON file, or enter its HTTPS URL
   and press **Refresh catalog**. A blank URL loads this server's `/model-catalog.json`.
4. Select the desired model and download/verify it in Model Manager before inference.

An existing APK needs one application update to acquire this catalog implementation.
After that, compatible catalog changes can be imported/refreshed without rebuilding the APK.
Updating the JSON bundled *inside* an old APK cannot change that installed file; import
the new JSON or refresh from an explicitly configured server instead.

Catalog refresh is explicit, not part of image processing or chat startup. The last validated
catalog is persisted locally and restored synchronously offline. A malformed response,
unsupported schema or storage failure leaves the working catalog in place.
The catalog URL must be accessible under the deployment's existing CSP/CORS rules.
Development browser CSP may require a same-origin catalog/assets; do not weaken CSP just
to load an untrusted source. Importing a local JSON file does not need a remote catalog URL.

## Configuration

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Currently `1`; incompatible versions are rejected. |
| `version` | Operator-supplied catalog version displayed in both UIs. |
| `models` | Ordered, complete list; omit a model or set `enabled: false` to remove it from selection. An empty list is valid. |
| `id`, `name`, `description` | Stable application-facing identifier and chooser text. |
| `adapter` | A supported, build-owned runtime adapter, not a JavaScript URL. |
| `repository`, `revision` | Hub repository and immutable 40-character commit. Branch names such as `main` are rejected. |
| `artifacts` | Every base graph, shard, tokenizer and processor file, with exact relative path, byte count and SHA-256. |
| `cacheKey` | Immutable cache identity. New keys start with `openchat-model-`; changed artifacts/revision require a new key. Existing bundled keys are retained for migration. |
| `dtype`, `sessionDtypes` | Overall label and exact per-session precision. Only precisions supported by the adapter are accepted. |
| `externalData` | Per-session list of declared artifact paths and the names expected by ONNX. Multiple decoder shards are supported, up to the validated limit. |
| `modalities` | Enabled text/image/audio inputs, constrained by adapter capabilities. |
| `optionalAudio` | Separate artifact list for opt-in voice support. Base readiness never requires these downloads. |
| `packagedArtifacts`, `packagedModelBase` | Graphs/artifacts hosted outside the original Hub revision. Despite the historical field name, the base may be a hosted HTTPS URL or same-origin asset path, not just APK assets. |
| `developmentModelBase` | Optional development-only base for those hosted artifacts. The bundled Qwen entry uses the existing development graph route. Other entries can use operator-hosted assets. |
| `generation` | `maxOutputTokens`, `doSample`, `temperature`, `topP`, `topK`, `repetitionPenalty`. |
| `artifactBytes` | Informational; the loader recomputes totals from the artifact list. |

Generation ranges: output 1–96 tokens, temperature 0.01–2, top-p 0.01–1,
top-k integer 1–100, repetition penalty 0.5–2. The effective output cap is the minimum of
the request, user setting and catalog limit. The catalog cannot override a smaller
application request or the runtime safety ceiling.

Derived artifacts can retain the existing bounded `source` declaration: immutable repository,
revision, file, exact byte range, source digest and `bf16-le-to-f32-le` transform.
No executable transform or custom script can be supplied.

The catalog is limited to 32 models and 512 KiB. Unknown fields, unsafe paths, duplicate
IDs/cache keys, missing shards and unsupported configurations fail closed.
Only import a catalog from an operator you trust: checksums establish artifact identity,
not the quality or safety of an arbitrary third-party model.

## Adapter compatibility

- `qwen3-vl-2b-staged-v1`: the existing Qwen3-VL **2B staged graph interface**, including
  its corrected vision/DeepStack, generation and decoder contracts. Per-session
  `q4`, `fp16` and `fp32` filenames are supported. A stock unrelated ONNX export
  is not automatically compatible. Mixed-precision candidates still require GPU/phone
  and accuracy qualification.
- `gemma4-e2b-row-v1`: the existing Gemma E2B `q4f16` graphs and exact supported
  row-streamed embedding layout, with optional audio encoder. This is not a generic
  adapter for all Gemma parameter sizes or quantizers.

New compatible weights/revisions/identifiers and supported settings require **catalog
changes only**. A new architecture, tensor layout, processor implementation, unsupported
precision or larger runtime safety envelope still requires an adapter/code update.
The runtime verifies graph/session contracts rather than silently falling back.

All learned embeddings, vision, audio encoding and decoding remain on WebGPU.
Catalogs cannot request a CPU fallback, arbitrary execution provider, remote inference,
another model on failure, or a second image pass.

## Updates, caching and app ownership

Each worker receives an immutable validated model snapshot. In-flight inference keeps that
snapshot. Catalog changes cancel an in-progress model download before it can activate stale
metadata. Readiness proofs are configuration-specific and invalidated on catalog changes;
the complete artifact verification remains mandatory before inference.

Switching, disabling or removing models does **not** delete downloaded weights. Removed
identities remain recognized as disabled, preventing accidental routing to another runtime.
Old caches are retained; **Delete retained download** requires an explicit confirmation.
Previous versions do not reappear as selectable defaults after catalog replacement.

OpenChat owns model loading and inference only. Applications own their prompts, model-specific
prompt templates, output schemas, domain fields and card/action interpretation. Adding a new
model ID may require application configuration for that app's prompt template; this catalog
does not inject or rewrite application prompts.

## Verification scope

### September 14 local phone checkpoint

The catalog-enabled combined local APK completed three consecutive image proposals with the
mixed-precision Qwen candidate, then a cached-model round trip and a fresh Gemma proposal.
The inspected app-authored cards verified, retained model caches were reused, and the corrected
observer recorded worker cleanup without an observed GPU error. Optional audio remained
uninstalled; this does not qualify voice inference or authenticated action delivery.

The tested Qwen candidate came from a separately pinned operator catalog and private artifact
host. **It is not the older all-q4 Qwen entry in the bundled catalog.** Do not transfer these
phone results to that entry or assume a fresh installation selects the candidate automatically.
A distributable catalog must retain the tested artifact identities and use an appropriate host.
The default/distribution choice is still pending; no model weights have been published.
The older diagnostic checkpoints below retain their original, narrower scope.

The native distribution verifier also imports only build-owned runtime and graph
identities. It checks both adapter graphs even with an empty selectable catalog,
and does not try to find operator-hosted catalog artifacts inside an APK.
Native-Node import and corrupt-asset regressions cover this post-build entry point;
Vite-only tests cannot establish that native tools can start.

September 13 packaging follow-up: native Node could not evaluate the Android
Rollup configuration because it transitively loaded the browser catalog JSON.
Build-owned runtime asset identities now live in an import-free module; the browser
protocol re-exports those same values. A regression imports the actual Rollup asset
target in native Node, without browser storage or Vite loaders.

The current model suite passes **662 tests in PR1 and 668 in PR2**. The rebuilt
worker differs from the earlier desktop-tested artifact only by the order of three
independent string constants and a source-map comment (verified against the complete
worker text). The historical GPU results below remain attached to their original
worker hash; this comparison is not a fresh APK/phone runtime qualification.

September 13: eight further checks pass using the PR2 shared catalog component,
production download/verification/inference APIs and the actual 2.26 GB candidate in native
Chrome CacheStorage. Cold reload, four sequential hardware-WebGPU calls (one repeated image),
worker closure, catalog removal/restoration with retained weights, same-size corruption
rejection and repair of only the damaged small file pass. No model network request occurs
during inference. The final run independently re-verifies the preceding real download;
it does not download the model again. Browser and server close cleanly.

Result: project-temp `output/playwright/model-delivery-cache-60eCSh/result.json`, SHA-256
`85105979064c93c526a83d03012e03126a0610551f153e03fdf2081ab6228b54`.
Two earlier failed harness records remain unchanged. The corrected test waits for actual
asynchronous worker-close events and distinguishes independently reproduced, fully verified
CacheStorage stream notifications from incomplete downloads or inference-time failures.
No model, prompt, production code or accuracy expectation changed for these test corrections.

This follow-up ran on PR2 only, whose production worker remains byte-identical to PR1's.
It is not the full account UI, an APK or phone qualification. The candidate package/catalog
remain separate, local and unactivated; no deployment or publication occurred.

September 12 final implementation checks: **661 tests in PR1 and 667 tests in PR2**,
each across 32 model-related suites. Both frontend type checks completed with **zero errors**
(existing warnings remain). Both independently built production workers are byte-identical:
974,153 bytes, SHA-256 `131557a3edb11a51f227c7cca76e4d90739d14a0152ba0e517cbefffd68916be`.

Real Chrome checks mount the shared catalog component from each checkout and use actual
file inputs, localStorage and CacheStorage. Importing a compatible custom ID/settings,
invalid import, full reload, complete model removal, retained cache data and explicit
same-origin refresh pass on both. Mobile-width (390px) and desktop-width controls have no
page overflow. The checks use tiny cache sentinels, not model weights or readiness proofs,
and run no inference. Their isolated browser/server instances close cleanly.

Bootstrap regressions also cover reordered/empty bundled catalogs, removal of Qwen and
omission of optional audio. Built-in graph packaging verifies adapter-owned byte/digest
constants independently of the editable model list. CI discovers catalog test families
and triggers on the JSON, registry, store and UI changes.
No server deployment, new APK installation, new weights or physical-phone qualification is
included in that result.

A prior one-image desktop hardware-WebGPU diagnostic also passed using a new model ID
and a validated mixed-precision Qwen configuration, with the unchanged production-built worker
(`e2d09f941f5643706622e51f6f7b40db34b336997784bca2f8e0cf1413433d08`). The worker accepted the
configured two-shard decoder and FP16 embedding artifact, returned the expected source fields,
and retired all 5,408 observed GPU buffers. There were no runtime, browser or transport errors;
the isolated browser, local server and child process exited cleanly.

This diagnostic used a test-only read-only loopback transport and generated the candidate's
FP16 table in memory from existing files. It did not import a catalog through Model Manager,
download/persist the candidate, exercise real CacheStorage, or qualify it for phone use.
The initial diagnostic returned correct model output but failed on two abandoned HTTP streams
from eager test-cache existence probes. A separately versioned lazy transport fixed that test
harness issue without changing model configuration, prompts, graphs or worker code; the original
failed record is retained. See [the release evidence](releases/model-app-readiness.md#current-per-model-accuracy-gate).

Subsequent eight-image runs confirm the runtime/configuration path, not candidate accuracy:
the unchanged app prompt and a heading-only revision each pass source/card checks on 6/8
images, while another existing prompt passes 3/8. Those variants remain unqualified and
unactivated. These diagnostic records bind the earlier worker hash shown above; they are not
a hardware rerun of the final bootstrap/export correction. The model-only PR1 port is now
complete and independently tested, without PR2 app/card/OCR code.

Unit/integration coverage exercises schema rejection, atomic storage, model removal,
remote-refresh failure, custom model IDs through the host/worker contract, generation
settings, UI imports, optional audio, and staged loader invariants. The production worker
must also build against the pinned Transformers/ORT patches.

These checks do not certify a newly added model's image/audio accuracy or phone memory
requirements. Qualify each new weight/precision configuration with the existing image corpus,
voice cases where enabled, and repeated physical-device GPU runs before publishing it.
