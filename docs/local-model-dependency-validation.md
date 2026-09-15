# Local model dependency refresh

## Scoped Sharp patch and optional Node download setting — 2026-09-15

The current model-parent override selects Sharp `0.35.4` / libvips `8.18.6`.
All 42 existing offline actual-Transformers image checks passed in an isolated
Windows candidate. Relevant CI dependency installs set `ONNXRUNTIME_NODE_INSTALL=skip`
to omit unused optional Node GPU downloads; browser WebGPU and native inference
settings are unchanged. This does not resolve the remaining adm-zip finding.
See [the scoped triage and verification limits](releases/npm-feature-advisory-triage.md).
Older versions, hashes and results below are retained historical evidence.

## Scoped npm response compatibility — 2026-09-15

The separately approved feature-only bulk request received HTTP 200 with a valid
620-byte JSON body, no Content-Type header, and advisories keyed by package name
without repeated inner `name` fields. The retained public response has SHA-256
`bb43a9b2d6a6ef5ea522955e623c50f9f3de61ee1786d939678fbfea5b3dbe11`; its exact
JSON values are frozen in `scripts/fixtures/npm-bulk-public-response-20260915.json`.
No request inventory, source, image, account data or credentials are in that fixture.

The official pinned npm 11.16.0 client calls `res.json()` in Arborist's
`lib/audit-report.js` and passes each outer package key to its advisory calculator.
The calculator fills an absent inner name from that key. Our collector now accepts
an absent MIME header only through the existing bounded, fatal-UTF-8, duplicate-key
rejecting JSON parser. Explicit conflicting MIME remains rejected. An inner name,
when present, must still exactly match the requested outer key.

HTTP status, size, deadlines, package scope, advisory IDs, severity, ranges and HTTPS
URLs remain validated. The captured moderate/high findings remain failures, not
exceptions or security approval. Separate fetch/retention/evaluation stages preserve
the bounded reply before semantic evaluation; failure receipts contain only local
allowlisted categories and numeric HTTP status, never arbitrary exception text.

The earlier assessment below is retained as historical evidence.

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

Lifecycle scripts were skipped during the install. These install and unit-test
results do not prove a complete normal postinstall, model accuracy, or
physical-device image/audio inference. Subsequent build evidence is listed below.

## Build-tool and security-check follow-up

The public-key build helper now accepts an optional `OC_DFX_EXECUTABLE` and checks
that the selected executable matches the repository's `dfx.json` pin before the
anonymous query. `OC_WSL_DISTRO` selects the Windows build's WSL distribution.
Neither input changes the installed default tool. A failed version check or query
preserves the previous key; only a validated response replaces it atomically.
The focused helper/build tests pass (19 tests), including mismatched versions,
quoted executable paths and failure preservation.

Both actual production frontend builds passed on 2026-09-06 using the pinned
`dfx` binary and real anonymous public-key queries. The default output contains
no optional Transformers WebGPU worker or JSPI WASM. The explicitly enabled
WebGPU candidate passes all 26 distribution asset checks, including 21 notices;
this verifies packaged identities, not inference. Build-only executable settings
are absent from emitted client files and archive entries. No production deployment
or APK installation occurred. Existing optional wallet-import/build warnings remain.

Portable dependency hashing, shell-free formatting and offline SBOM lock-identity
helpers now have CI coverage: 49 generic policy/packaging tests and 12 historical
hash tests pass. Historical proofs run in the full-history security checkout.
Only digest representation was migrated; reviewed dependency content, advisory
allowances and expiry were not updated. The security gate still fails for changed
frontend dependencies and the expired review, as intended.

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
that diagnostic. Upstream reconciliation, hosted checks and final device
acceptance remain separate gates. APK preparation is for
local testing only: publisher signing and store submission are outside this task;
the existing local package, signing certificate, account and model cache must be
preserved.
