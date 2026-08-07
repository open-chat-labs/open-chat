# Third-party notices: on-device inference

This notice applies to OpenChat native bundles built with the `inference` feature. It supplements
OpenChat's AGPL-3.0 license; it does not replace it.

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

OpenChat does not bundle or redistribute the catalog's model weights or vision projector. A user who
chooses a model downloads each file directly from its publisher at an immutable revision, after the UI
shows its license and requires acceptance. The built-in `gemma-4-e2b-it-q4` model and its
`mmproj-F16.gguf` projector are both from
`unsloth/gemma-4-E2B-it-GGUF@0314792d7f1f7e229411f620751375812bb9faf2`, whose repository metadata
declares Apache-2.0 and links to Google's Gemma 4 Apache-2.0 license.

The 14 MB TinyLlama GGUF used by CI is MIT-licensed, downloaded only during CI from the immutable
`tensorblock/tinyllama-15M-stories-GGUF@227c5a5ad3c1a830901543cf9959c53572014a68` revision, verified
by SHA-256, and never bundled with OpenChat.

PR1 introduces no WebAssembly runtime or WebAssembly binary.
