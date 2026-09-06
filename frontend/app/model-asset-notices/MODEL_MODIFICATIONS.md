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

| Graph stage                                                 |   Bytes | SHA-256                                                            |
| ----------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| Hub decoder graph at the above conversion revision          |  597123 | `7fe8b951dd605513efc01553ee98a00c9335b41c22b68790433bd3563521782f` |
| Local Adreno decoder graph, before tied-embedding transform | 5086584 | `0b309c7423500f5226b07e1895adbecb245105a61abe065dedeb5ae136da335c` |
| Packaged decoder graph, after tied-embedding transform      | 5087381 | `1c7b80033889ec7e5168e3d35942041e0aafcbb259a417f378da0432b434e04d` |
| Hub vision graph at the above conversion revision           |  338758 | `7ccbf866b2e0d0c59272c741715fd78764c8777f1063efe070d420191255c9fe` |
| Local and packaged Adreno vision graph                      |  388996 | `9e4585fdc96e118b27412133e3a37dca85f1abd471015accad9e76bc9959e6c3` |

The upstream sizes/hashes above are from immutable Git LFS pointers. Local graph
hashes are pinned in OpenChat's source. Packaged-artifact validation compares the
resulting files against those exact identities.

The local decoder's existing ONNX `doc_string` identifies an OpenChat test-only Adreno
workaround: 28 fused decoder GQA nodes were expanded, with explicit causal masking,
float32 attention accumulation and preservation of the source cache dtype. The vision
graph's existing `doc_string` identifies expansion of 24 fused vision MHA nodes.
These embedded notices are retained; this notice addition does not alter graph bytes.
The initial Hub-to-Adreno conversion is not reconstructed by the current build helper.

`frontend/app/transformersWebGpuDecoderGraph.mjs` then deterministically adds a private
token-ID input and Reshape/GatherBlockQuantized/Concat nodes, reusing existing tied
LM-head quantized embedding ranges. It validates both the source and output digests
and does not rewrite the external weight shard. Companion `.onnx.NOTICE.txt` files
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
ONNX Runtime Web `1.29.0-dev.20260723-1b1e1db7bc` binaries are package-pinned and
redistributed without changes. Their MIT license and the complete upstream third-party
notice file accompany the runtime; this notice file covers upstream configurations
beyond the WebAssembly build and is not an assertion that every listed library is linked.
