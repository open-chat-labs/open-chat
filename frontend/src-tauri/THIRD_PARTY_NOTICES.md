# Third-party notices: on-device inference and model assets

This notice covers the components below when they are included in an OpenChat build. Native
inference, browser Wllama and all-WebGPU models are separate build/runtime choices; this
inventory does not imply every component is included in every build. It supplements OpenChat's
AGPL-3.0 license; it does not replace upstream component licenses.

## Browser and all-WebGPU runtime assets

The model asset notice helper emits the applicable texts under `assets/licenses/model-assets`.
The same directory is included in the Tauri frontend
bundle and Android OTA archives when those builds redistribute the associated runtimes.

| Component                                   | Exact identity                                                                                        | License and attribution                                                                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wllama JavaScript and WebAssembly           | `@wllama/wllama` 3.5.1; source `912c18b75d4358c1405a64646b8dbe43a205943b`                             | MIT; copyright 2024 Xuan Son NGUYEN. Complete `wllama-MIT.txt`.                                                                                                                                                                                      |
| Wllama's embedded llama.cpp/ggml            | Source submodule `dd4623a74f0c85e6b1dd9ee99a92b9c67cac3708`                                           | MIT; copyright 2023-2026 The ggml authors. Complete `wllama-llama.cpp-MIT.txt`. This is distinct from the native Rust runtime revision below.                                                                                                        |
| Wllama's embedded C++ support               | nlohmann/json and cpp-httplib at that same llama.cpp revision                                         | MIT; complete `wllama-jsonhpp-MIT.txt` (Niels Lohmann) and `wllama-cpp-httplib-MIT.txt` (yhirose).                                                                                                                                                   |
| Wllama's embedded image/audio support       | stb_image and miniaudio at that same llama.cpp revision                                               | Complete dual-license blocks: `wllama-stb_image-LICENSE.txt` (Sean Barrett; MIT or public domain) and `wllama-miniaudio-LICENSE.txt` (David Reid; MIT-0 or public domain).                                                                           |
| Wllama's generated WebAssembly support      | Published build script: Emscripten 4.0.20; source `6913738ec5371a88c4af5a80db0ab42bad3de681`          | Emscripten MIT/NCSA and bundled Node attribution, musl copyright/license notices, and libc++/libc++abi Apache-2.0-with-LLVM-exception and legacy license texts are retained in the respective `wllama-*` files. The compiler itself is not bundled.  |
| Transformers.js                             | `@huggingface/transformers` 4.2.0; npm integrity pinned in `sources.json`                             | Apache-2.0; Hugging Face and contributors. Complete `huggingface-transformers-Apache-2.0.txt`. OpenChat's worker adaptations are described in `MODEL_MODIFICATIONS.md`.                                                                              |
| ONNX Runtime Web JavaScript and WebAssembly | `onnxruntime-web` `1.29.0-dev.20260723-1b1e1db7bc`; source `1b1e1db7bcf583e5927588e8d85c5a89717dc45c` | MIT; copyright Microsoft Corporation. Complete `onnxruntime-MIT.txt` and upstream `onnxruntime-ThirdPartyNotices.txt`. The latter covers upstream configurations beyond WebAssembly; its inclusion does not assert every listed component is linked. |

`sources.json` records immutable upstream URLs, checked package identities and hashes of the
preserved notice texts. This is attribution evidence, not a rebuilt-binary attestation or release
approval. The dedicated helper fails if a selected package identity or preserved notice changes.

## Packaged and downloadable ONNX model files

All-WebGPU builds redistribute two modified Qwen graph definitions in the builds that package
those assets; remaining weight shards and model files are downloaded separately. The original
Qwen publisher's immutable card declares Apache-2.0. The selected ONNX conversion revision has no
README, LICENSE, NOTICE or license-card metadata of its own; this notice does not invent one.
`MODEL_MODIFICATIONS.md` records original publisher attribution, exact Hub/local/output graph
hashes, existing embedded Adreno modification notices, the deterministic tied-embedding transform,
and the scope of conversion history that is not reconstructed by the current build. Companion
`.onnx.NOTICE.txt` files are emitted alongside the redistributed graphs.

The Gemma 4 ONNX card at the pinned revision below declares Apache-2.0 and identifies Google
DeepMind's original model. That declaration covers the model's text/image and optional audio files;
these are not earlier Gemma custom-license terms. Gemma files remain separate downloads, not
bundled weights. Runtime changes to the in-memory decoder and selected embedding rows are also
described in `MODEL_MODIFICATIONS.md`; cached publisher files remain unchanged.

## Native code and Rust packages included in the bundle

| Component                                                           | Version                                                                           | License           | Disposition                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| llama.cpp / ggml                                                    | `9e3b928fd8c9d14dbf15a8768b9fdd7e5c721d66`, vendored by `llama-cpp-sys-2` 0.1.150 | MIT               | Compiled into the native inference runtime. Copyright 2023-2026 the ggml authors.     |
| `llama-cpp-2`, `llama-cpp-sys-2`                                    | 0.1.150                                                                           | MIT OR Apache-2.0 | OpenChat elects Apache-2.0 for the Rust wrapper code; vendored llama.cpp remains MIT. |
| `open`                                                              | 5.3.6                                                                             | MIT               | Opens validated external URLs. Copyright 2015 Sebastian Thiel.                        |
| `minijinja`, `minijinja-contrib`                                    | 2.21.0                                                                            | Apache-2.0        | Renders model-provided chat templates. Copyright Armin Ronacher and contributors.     |
| `memo-map`                                                          | 0.3.3                                                                             | Apache-2.0        | Transitive template cache. Copyright Armin Ronacher and contributors.                 |
| `is-docker`, `is-wsl`                                               | 0.2.0, 0.4.0                                                                      | MIT               | Platform detection. Copyright 2023 Sean Larkin.                                       |
| `sha2`, `hex`, `cc`, `find-msvc-tools`, `find_cuda_helper`, `shlex` | versions pinned in `Cargo.lock`                                                   | MIT OR Apache-2.0 | OpenChat elects Apache-2.0 for these integrity, build, and platform dependencies.     |
| `bindgen`                                                           | 0.72.1                                                                            | BSD-3-Clause      | Build-time tool; it is not linked into or bundled with the application.               |

The complete MIT and Apache-2.0 texts are bundled in `THIRD_PARTY_LICENSES`; the table preserves the
copyright notices for MIT-only code compiled into the application. `bindgen` is a build-time tool,
so its BSD-3-Clause source and notice are not redistributed in the application bundle; it remains
recorded in the generated CycloneDX SBOM.

## Downloadable models and projectors

OpenChat does not bundle the GGUF catalog's model weights or vision projector. A user who
chooses a model downloads each file directly from its publisher at an immutable revision, after the UI
shows its license and requires acceptance. The built-in `gemma-4-e2b-it-q4` model and its
`mmproj-F16.gguf` projector are both from
`unsloth/gemma-4-E2B-it-GGUF@0314792d7f1f7e229411f620751375812bb9faf2`, whose repository metadata
declares Apache-2.0 and links to Google's Gemma 4 Apache-2.0 license.

The feature-gated all-WebGPU client also supports the ONNX-community conversion at
`onnx-community/gemma-4-E2B-it-ONNX@9f4bef82ea6e296bc69f8a2f5939f73af81b07a6`.
Its pinned text/image files are downloaded and SHA-256 verified only when the user selects that
model. The voice encoder is a separate optional download requested from the model settings; it is
not part of the text/image installation. Neither the Gemma text/image weights nor the optional
voice encoder is bundled in OpenChat's web or Android package.

The 14 MB TinyLlama GGUF used by CI is MIT-licensed, downloaded only during CI from the immutable
`tensorblock/tinyllama-15M-stories-GGUF@227c5a5ad3c1a830901543cf9959c53572014a68` revision, verified
by SHA-256, and never bundled with OpenChat.
