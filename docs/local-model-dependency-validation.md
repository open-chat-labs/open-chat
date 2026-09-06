# Local model dependency refresh

Assessment: 2026-09-06. This is local validation evidence, not release approval.

## Change boundary

The refresh starts from the model-only `a26f51692` source. It carries reviewed
compatible dependency patches and parent-scoped compatibility checks from the
combined integration branch. It does not change model artifacts, runtime pins,
inference providers, optional-audio behavior, application identity or signing.

- Tiptap resolves its exact peer family at `3.31.3`; DOMPurify is `3.4.14`.
- Compatible inherited parser, selector and utility patches remain within their
  existing major contracts.
- Scoped overrides are CDP SDK `1.52.0` / Axios `1.18.1`, query-string `8.2.0` /
  decode-uri-component `0.5.0`, Transformers `4.2.0` / Sharp `0.35.3`, and ONNX
  Runtime Node `1.24.3` / adm-zip `0.6.0`.
- All eight original Transformers/Jinja/tokenizer/Wllama/ONNX parent and runtime
  lock records are unchanged. Sharp's optional platform/WASM image-library
  records do not enable a WASM inference fallback.
- CI runs all four actual-parent compatibility scripts after the frozen install.
  Regressions guard invocation, path coverage and the model overrides' scope.

Canonical LF lock SHA-256:
`8a94b1f57f62449655e23f5ccb6af6fa2561ebe42df4bbe8b7e52c4d566065ac`.

## Checks completed

A separate Windows x64 snapshot used Node `24.14.1` and npm `11.11.0`. Hosted CI
uses Node `24.18.1`; local evidence is not a substitute for that hosted run.

- `npm ci --ignore-scripts --no-audit --no-fund`: 1,392 packages, unchanged lock.
- Full frontend: 66 suites / 872 tests, zero skipped.
- Svelte: zero errors / 560 existing warnings; agent TypeScript passes.
- Read-only ESLint: zero errors / 30 existing warnings.
- Actual-parent checks: CDP/Axios 7, decoder 275 cases plus URL/stress checks,
  ONNX installer 11, and Transformers/Sharp/libvips 42; all pass.
- Generic Node policy: 35 tests pass. New policy assertions first failed before
  their workflow/manifest changes, then passed.
- Actual development/local explicit-WebGPU worker emission passes.

Lifecycle scripts were skipped during the install. These results do not prove a
complete normal postinstall, a production Rollup bundle, model accuracy, or
physical-device image/audio inference.

## Remaining checks and findings

Fresh npm audit submission is blocked pending explicit permission to send the
dependency inventory to npm. A local-only correspondence check found all outgoing
package/version pairs in already public project locks; that did not satisfy the
approval gate. No alternative upload or security-policy waiver was performed.

Offline matching against the earlier advisory report still identifies the
inherited Jayson / stream-json chain. The patched stream-json major is outside
the parent's declared contract; no unverified major override was added. This is
not a fresh-audit count or a claim that all advisories are resolved.

`npm ls --all` is not clean: seven inherited peer issues remain, along with two
Windows optional-orphan entries from Sharp's new cross-platform closure. The
actual native Sharp checks pass; optional lock records were not pruned to hide
that diagnostic. Full production packaging, upstream reconciliation, hosted
checks and final device acceptance remain separate gates.
