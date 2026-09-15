# Selected npm model-dependency advisory triage — September 15

This note covers only the two public findings in the approved npm bulk-response
diagnostic, matched to the retained selected model/app dependency inventories.
The initial finding assessment is retained below, followed by the narrowly scoped
patch and installation follow-up. Neither is a whole-core audit or release approval.

## Source and response identity

The inspected published candidates are:

- PR1: `3ea234c43c576c664bce669354784d2a5d3883ce`.
- PR2: `2b17aa16e973c573f1ac28476639aa7c2417df36`.
- Reconciled upstream base: `df9d9ed52db00e87fbb7309280a325902c9bb2cc`.

The exact retained raw response has SHA-256
`bb43a9b2d6a6ef5ea522955e623c50f9f3de61ee1786d939678fbfea5b3dbe11`.
Preserve those bytes and the original failed check results. A raw diagnostic
response is not by itself complete source-bound collector or release acceptance.

## Findings and ownership

| Finding                                                                                               | Exact selected dependency path                                              | Affected and patched versions                                         |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| High — [GHSA-rgj7-g3m4-5g8c](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) | `@huggingface/transformers@4.2.0 → sharp@0.35.3`                            | Affected: `<0.35.4`. Patched: `0.35.4`.                               |
| Moderate — [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9)                   | `@huggingface/transformers@4.2.0 → onnxruntime-node@1.24.3 → adm-zip@0.6.0` | Affected: `>=0.5.9 <=0.6.0`. No patched release listed when reviewed. |

The direct selected root is `@huggingface/transformers@4.2.0`. The reviewed
parent-scoped overrides select Sharp `0.35.3` and adm-zip `0.6.0`; the parent
requests are respectively `^0.34.5` and `^0.5.16`. The retained model inventory
records these effective edges as valid.

None of Transformers, Sharp, ONNX Runtime Node or adm-zip is present in the
reconciled upstream base lockfile. Both exact candidate heads contain the listed
identities. These are therefore **PR1-introduced model dependencies**, not
inherited OpenChat core findings. PR2's additive app-only inventory contains
neither advisory package; its combined assessment inherits the unchanged PR1
model dependency closure.

The September 14 user-directed inherited-advisory deferral documents ten
Rust/OSV findings in [the Rust triage](rust-feature-advisory-triage.md). It does not
cover these two npm findings. Their presence in the PR2 stack does not turn them
into upstream-inherited dependencies or extend that deferral.

## Relevant reachability and verification limits

Sharp is the Transformers Node image-decoding backend. Its maintainer describes
libheif vulnerabilities affecting untrusted input, including possible code
execution under certain glibc Linux conditions. The patch supplies libheif
`1.23.2`. Browser/WebWorker image handling in the inspected Transformers source
uses `createImageBitmap` and `OffscreenCanvas` instead. This separates the Node
dependency finding from the browser inference path; it is not a whole-artifact
absence proof or a demonstration of a phone WebGPU vulnerability.

adm-zip is used by ONNX Runtime Node's installer to extract selected NuGet
entries. The inspected `script/install-utils.js` creates a timestamp-named
directory under the system temporary directory and calls
`extractEntryTo(zipEntry, extractDir, false, true)`. The final argument enables
overwrite. The advisory requires attacker-controlled destination symlinks; this
parent call has the relevant overwrite behavior and a predictable temporary
path. No exploit against the project or its hosts was performed. This is an
installer/local-filesystem concern, not a demonstrated browser image-inference
issue.

The existing actual-parent compatibility checks exercise normal Sharp image
operations and ONNX extraction, copy and cleanup. The ZIP allocation regression
targets a different vulnerability. Those successful tests do not prove
resistance to the current symlink issue or malicious libheif inputs.

## Initial disposition (retained)

The initial conservative known-advisory gate was **failed**. No finding was suppressed
or described as harmless, and no upstream CI or release-policy exception is
claimed. Functional, build and phone checks do not replace this disposition.

The initial triage recommended assessing Sharp's patch and a narrow ONNX installer
mitigation. No patched adm-zip release was listed; an
[upstream proposed fix](https://github.com/cthackers/adm-zip/pull/575) is not a
verified released dependency. No fork was installed or inherited Rust deferral reused.

## September 15 patch and installation follow-up

The Transformers-scoped Sharp override is now `0.35.4`, with the corresponding
`@img` native packages and libvips `8.18.6`. This is the maintainer's patched
release for the high-severity finding above. Exactly 27 existing Sharp-related
lock records change in each PR; no unrelated package versions, model weights,
prompts, Transformers or ONNX runtime versions change.

An isolated Windows x64 check using Node `24.18.1` imported the unchanged
Transformers `4.2.0` Node ESM entry and passed all 42 existing image API checks
against Sharp `0.35.4`. It downloaded only the two required public Windows
archives (8,703,196 bytes total), verified their registry SHA-512 digests and ran
no lifecycle scripts or model inference. This is patch compatibility evidence,
not malicious-image testing, a fresh advisory query or a new phone acceptance
run. The previous mixed pad/crop limitation remains explicitly tested as a
rejection, not counted as a working transformation.

The relevant frontend, model-security and Android dependency-install steps now
set `ONNXRUNTIME_NODE_INSTALL=skip`. PR2's app-interface security install does
the same. ONNX Runtime Node `1.24.3` documents this setting in its installer:
it exits before selecting or downloading optional Node GPU binaries. The setting
does not disable browser WebGPU, the separate native Rust runtime, other npm
lifecycle scripts, or the already bundled Node CPU libraries. The Android install
also uses `npm ci --no-audit`; no whole-core audit is introduced.

A benign check of the pinned installer passed four skip cases and two guarded
ordinary-setup controls, with all file/network/extraction operations inert.
No archive or adversarial filesystem fixture was constructed. Module imports and
proxy bootstrap precede the skip, so this is **not** a claim that the affected
library is absent or never initialized. Workflow regressions require the setting
on every reviewed install and reject additional unguarded install commands.

For a local frontend dependency install, set the variable for that command too:

```sh
ONNXRUNTIME_NODE_INSTALL=skip npm ci --no-audit
```

In PowerShell, set `$env:ONNXRUNTIME_NODE_INSTALL = 'skip'` for the install
process, then run `npm ci --no-audit`. Do not mistake CI's step-local setting for
a global policy on other manual installs.

The moderate adm-zip finding remains **open**: `0.6.0` is still selected and
no patched release was listed in the reviewed advisory. Disabling this optional
download path is a bounded prevention measure, not a dependency fix or an
allowlist entry. Its release disposition requires a separate decision; the
inherited Rust deferral and accepted model note limitation do not cover it.
No advisory gate has been suppressed or changed to report a clean result.

Private local compatibility receipts are retained beneath the project-specific
temporary root in `sharp-0354-candidate-20260915-OanUei/` and
`sharp-0354-pr1-candidate-20260915-ee2qMa/`. The initial response identity and
failed historical results above remain intact.
