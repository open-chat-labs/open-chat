# Model artifact provenance and modifications

This file describes the model files used by OpenChat; it does not change their licenses,
endorse a build for release, or claim the entire conversion history was reproduced.
The original publisher cards and complete Apache-2.0 license accompany these notices.

## Qwen3-VL-2B-Instruct

Original model: Qwen, `Qwen/Qwen3-VL-2B-Instruct` at
`89644892e4d85e24eaac8bacfd4f463576704203`. Its immutable model card declares
Apache-2.0; a copy is included as `Qwen3-VL-2B-original-MODEL_CARD.md`.

ONNX conversion: `onnx-community/Qwen3-VL-2B-Instruct-ONNX` at
`3e4136ea66ae6e07c110e64fe07da2e029517ab5`. The immutable repository tree was checked
on 2026-09-06: it contains neither a README/model card nor a LICENSE/NOTICE file, and
its API response supplies no license or base-model card metadata. The original model's
Apache-2.0 declaration is the attribution source; this document does not invent a
separate conversion-publisher license declaration or prove the conversion's ancestry.

OpenChat redistributes two **modified** graph definitions, not the unmodified Hub
graphs. These graph files are not full model weight shards. Remaining pinned model
files and external weight shards are downloaded separately when a user installs the model.

| Graph stage                                                                                     |   Bytes | SHA-256                                                            |
| ----------------------------------------------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| Hub decoder graph at the above conversion revision                                              |  597123 | `7fe8b951dd605513efc01553ee98a00c9335b41c22b68790433bd3563521782f` |
| Local Adreno decoder graph, before tied-embedding transform                                     | 5086584 | `0b309c7423500f5226b07e1895adbecb245105a61abe065dedeb5ae136da335c` |
| Intermediate decoder, after tied-embedding transform                                            | 5087381 | `1c7b80033889ec7e5168e3d35942041e0aafcbb259a417f378da0432b434e04d` |
| Intermediate decoder, after interleaved-mRoPE correction                                        | 5085647 | `29df8b402b9dc86a3e2683911f1e4a28067f12713ae3c1715851feb0e39b20e3` |
| Intermediate decoder, after DeepStack restoration                                               | 5086571 | `dee3961fa1fe66c37f3f716d44a8daf571e12a4c5c6ce7884f99fe31454e83e8` |
| Packaged generation-only decoder, after host controls, embedding alias and last-position logits | 4896612 | `475d9ad51b0da52e7510a8b597bdf42a533e552de3a3b74c58284ae6b2472375` |
| Hub vision graph at the above conversion revision                                               |  338758 | `7ccbf866b2e0d0c59272c741715fd78764c8777f1063efe070d420191255c9fe` |
| Local Adreno vision graph, before DeepStack restoration                                         |  388996 | `9e4585fdc96e118b27412133e3a37dca85f1abd471015accad9e76bc9959e6c3` |
| Intermediate vision graph, after DeepStack restoration                                          |  395100 | `0b494b36663cc3ce66a34b33fb03e7f722c2957d10db29d55fe63854e7d358be` |
| Packaged vision graph, after grouped attention and host geometry                                |  576592 | `b62a78861a16cb0023156cc20dc6d8d7f0d97c99ce2360a9b4670d2f9327f6ac` |

The upstream sizes/hashes above were first obtained from immutable Git LFS pointers
and subsequently verified against the exact small graph files. Local graph hashes
are pinned in OpenChat's source. Packaged-artifact validation compares the resulting
files against those exact identities.

The local decoder's existing ONNX `doc_string` identifies an OpenChat test-only Adreno
workaround: 28 fused decoder GQA nodes were expanded, with explicit causal masking,
float32 attention accumulation and preservation of the source cache dtype. The vision
graph's existing `doc_string` identifies expansion of 24 fused vision MHA nodes.
These embedded notices and the checked-in source graph bytes are retained unchanged.
The initial Hub-to-Adreno conversion is not reconstructed by the current build helper.

`frontend/app/transformersWebGpuDecoderGraph.mjs` then deterministically adds a private
token-ID input and Reshape/GatherBlockQuantized/Concat nodes, reusing existing tied
LM-head quantized embedding ranges. The intermediate graph is independently verified
before `frontend/app/transformersWebGpuMropeGraph.mjs` replaces sixteen contiguous
frequency-selector nodes with Qwen3's interleaved selection and adds five inline
constants. The selection follows the [official Qwen3 implementation](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/qwen3_vl/modeling_qwen3_vl.py#L272):
height uses indices 1,4,...58; width uses 2,5,...59; the other frequencies retain the
temporal axis. This does not change the separate `RotaryEmbedding.interleaved`
attribute, attention operations, tied-embedding path, or external model weights.

Exact upstream comparison confirms the contiguous selection and missing DeepStack
path predate OpenChat's Adreno modifications. The mRoPE correction alone does not
restore the missing learned DeepStack mergers. Its tests verify corrected frequency
selection, unchanged text-only positions and preservation of unrelated graph content.

`frontend/app/transformersWebGpuDeepStackGraph.mjs` subsequently restores three
learned merger branches from vision layers 5, 11 and 17. Each branch reshapes to
4096 channels before its own learned normalization and two linear layers; the
existing final merger's differently placed normalization and weights are not reused.
Three additional float32 feature outputs feed private decoder inputs. After decoder
layers 0, 1 and 2, the existing two residual operands are added first, then the
corresponding DeepStack features, before the next RMS normalization; both the
normalized output and residual carry retain their original connections.

The 18 learned tensors come directly from the original Qwen revision above, not
the incomplete ONNX conversion. In `model.safetensors` (4,255,140,312 bytes), their
contiguous payload occupies inclusive byte range **4,045,844,952–4,196,925,911**:
151,080,960 bytes, SHA-256
`fecb4139b02964dea60cc588fdf3020796cb56280eb89626f2695617f72643d3`.
The 76,240-byte metadata header has SHA-256
`a4c22c14e0d987dd572a283e92643374babeccc2f86cf2f8020e6144389c3f4d`.
The payload digest was captured and verified locally against that immutable range;
it is not a separately published upstream subset digest.

The download-time `transformersWebGpuArtifactTransform.ts` strictly verifies the
partial response, expands BF16 little-endian bits losslessly into float32
little-endian, and verifies both source and output digests. It does not retrain or
requantize weights, or accept a whole-file response instead of the exact range.
The resulting additional external-data file,
`vision_encoder_q4_deepstack.onnx_data`, is 302,161,920 bytes, SHA-256
`f331bfc4a32c5dcda5a3589283acd90672f8f903cda0d8f425f8aaaf0b148168`.
All existing external weight shards remain unchanged.

`frontend/app/transformersWebGpuQwenGenerationGraph.mjs` then applies a
**generation-only** transform to that exact DeepStack-restored decoder:

- It replaces a source-bound shape/control subgraph with eight private INT64
  inputs, removes five already-unused shape nodes, and removes stale value
  declarations. In total, 718 nodes are removed and 198 control boundaries are
  supplied by the host. The paired `transformersWebGpuQwenGenerationRuntime.mjs`
  derives these controls from validated tensor dimensions, not learned tensor
  values. Batch size is one; the current sequence plus past-cache length is at
  most 1024, and all 56 cache shapes must agree. Actual attention-mask,
  position-ID, embedding and cache values remain original inputs to the graph.
- It removes the UINT8 Reshape before tied-embedding GatherBlockQuantized by
  adding a two-dimensional initializer alias over the same row-major external
  bytes. The alias retains offset 903290880 and length 155582464 in
  `decoder_model_merged_q4.onnx_data`; it neither duplicates the stored weight
  payload nor requantizes it. This byte alias alone is not a claim about the
  runtime's physical allocation behavior.
- It slices the last hidden position before the unchanged quantized LM head.
  Only the final position's logits are produced, with shape `[1,1,151936]`;
  all 56 KV-cache outputs remain unchanged. This graph serves next-token
  generation, not training or all-token scoring. The complete graph has 1746
  nodes, 764 initializers, 71 inputs and 57 outputs.

`frontend/app/transformersWebGpuQwenVisionGraph.mjs` independently transforms
the exact DeepStack-restored vision graph. Each of its 24 attention blocks is
split into four groups of four heads and concatenated along the head axis.
Every group still attends over all sequence positions using the original
scale, mask and softmax axis. No learned attention weights are replaced.
The source-bound 91-node pixel/grid shape and position-index subgraph becomes
thirteen private geometry inputs. `transformersWebGpuQwenVisionGeometry.mjs`
computes only this fixed metadata program from the validated image grid;
it never reads pixel values or model weights. Its admitted single-image grids
have even height/width from 16 to 32 and at most 640 patches (55 grids).
`transformersWebGpuQwenVisionSession.mjs` owns those temporary control tensors
and releases them after native execution settles. Learned position embeddings,
rotary trigonometry, the final merger and all three learned DeepStack branches
remain in the graph. The complete graph has 1770 nodes, 560 initializers,
15 inputs and the same four feature outputs.

These two build-time transforms reject any source graph other than the pinned
input above, verify the exact output bytes, and retain reversible checks for
the original graph content. Neither changes cached external weight shards,
the model revision, prompt text, labels or application action data. Host
metadata preparation is explicit tensor setup, not an ONNX CPU fallback or
CPU execution of the learned model operations.

The staged runtime preserves the original prompt token IDs and copies the three
vision feature outputs into matching image-token positions; cached decoder steps
receive zero DeepStack features. This CPU-side transport only places tensor data;
it does not compute the learned merger or decoder operations, whose sessions
remain configured for WebGPU. Graph/source checks do not establish full-model
image accuracy, successful execution on a phone, or release qualification.
Separate bounded native GPU comparisons covered the transformed generation
and vision components. Those component results do not establish assembled-worker,
APK, phone or prompt-accuracy qualification; distribution verification remains
packaging evidence only.

The build validates source, intermediate and final output digests and does not
rewrite the existing external weight shards. Companion `.onnx.NOTICE.txt` files
are distributed beside each graph, and this complete description is also bundled.

OpenChat additionally normalizes the processor configuration and applies runtime
session-management adaptations in its worker. These are application/runtime changes,
not a claim that the original model publisher authored or endorsed OpenChat's behavior.

## Gemma 4 E2B: text, image and optional audio

The original model authors are Google DeepMind. The installed conversion is
`onnx-community/gemma-4-E2B-it-ONNX` at
`9f4bef82ea6e296bc69f8a2f5939f73af81b07a6`. Its immutable model card explicitly names
`google/gemma-4-E2B-it` as the base and declares Apache-2.0, linking Google's
<https://ai.google.dev/gemma/docs/gemma_4_license>. This is Gemma **4**, not an earlier
Gemma release under custom Gemma terms. A copy of the pinned card is included as
`Gemma4-E2B-ONNX-MODEL_CARD.md`.

The text/image installation and optional audio encoder use the same revision/license.
The optional encoder files are `onnx/audio_encoder_q4f16.onnx` (260446 bytes,
SHA-256 `5e0deb22791685c792d4b8e089deef9670fa4a4cecde434213d6a742e58fc3fa`)
and `onnx/audio_encoder_q4f16.onnx_data` (171258112 bytes,
SHA-256 `df58e61a00bafa9449ee5fd52895ce952f158bbdd1fe38df8a68f48f36842e62`).
Audio remains a separate, user-requested download; neither adding notices nor selecting
the base model downloads it. Gemma weights/graphs are not bundled into the web/APK assets.

OpenChat's `gemma4WebGpuEmbedding.ts` gathers selected rows from the unchanged pinned
embedding data and dequantizes them on WebGPU to bound device memory usage. This runtime
adaptation does not replace the downloaded model's license or change its stored bytes.
Before creating an inference session, `patchGemma4DecoderForStandardSoftmaxRouting`
creates a modified in-memory decoder copy: redundant `rotary_interleaved=0` attributes
are replaced with a `smooth_softmax=1` routing sentinel. The paired runtime wrapper
removes that sentinel from generated softmax WGSL; the 512-token sliding window and
external-data offsets are preserved. This is an OpenChat modification, not an
unmodified execution of the publisher's graph, and does not rewrite cached source files.

## Runtime software adaptations

Transformers.js 4.2.0 is Apache-2.0 software from Hugging Face and contributors.
OpenChat applies source-checked staged-session adaptations when building its worker;
those adaptations are maintained in `transformersWebGpuSequentialSessions.mjs`.
ONNX Runtime Web `1.29.0-dev.20260723-1b1e1db7bc` native WebAssembly binaries are
package-pinned and redistributed without changes. The source-checked
`transformersWebGpuOrtSessionConfig.mjs` build adaptation forwards the explicitly
requested INT64 option before native WebGPU provider creation; normal later
option handling remains intact. It changes the JavaScript bridge, not the
native binary, and does not relax CPU-fallback rejection. The runtime's MIT
license and the complete upstream third-party
notice file accompany the runtime; this notice file covers upstream configurations
beyond the WebAssembly build and is not an assertion that every listed library is linked.
