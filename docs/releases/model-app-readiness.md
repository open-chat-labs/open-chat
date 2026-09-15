# Model and app integration: PR and release readiness

Assessment: 2026-09-15. **Scoped local checks pass; exact-head hosted acceptance is pending.**
No PR, release, PR branch base, production switch, signing key, or production service was changed
by this preparation. App-owned local registration updates are recorded below. The locally
reconciled stack has not been pushed or published.

## Final scoped PR checks — September 15

Fresh selected local suites pass, without changing assertions, mocks or timeouts:

| Source slice | Frontend contracts | Offline CI/packaging helpers |
| --- | --- | --- |
| PR1 | 49 files, 972/972 tests | 590/590 tests |
| PR2 | 91 files, 1,892/1,892 tests | 915/915 tests |

Successful runs have no failures or skipped tests. Source-bound npm ownership and executable
feature-CI contract checks also pass in both slices. These local runs used Node 24.14.1;
the hosted workflow pins 24.18.1, so exact CI-runtime qualification is not claimed. No new
advisory query, whole-lock/core audit, native build or APK build was run for this checkpoint.
Existing inherited findings remain documented/deferred, not suppressed or reported clean.

Two local dependency prerequisites were repaired without editing runtime source or locks:
PR1's missing Tauri CLI JavaScript/type files were restored byte-for-byte from the matching
pinned local install (27,712 bytes), and PR2's missing `component-lib` file-dependency junction
was restored to its existing source package. Initial failure receipts remain intact. The
unchanged isolated card suite then passed 43/43, followed by all 91 selected PR2 files. The
initial setup timeout alone is not assigned a speculative product or resource-contention cause.

Fresh GitHub inspection found both PRs open and draft, with empty check rollups and no branch
workflow runs or submitted reviews. PR1 still requires review. Published heads remain
`045f7132e502ba01c56343800217070aa2ce4ea0` and
`c7299aa11b87fbfd56029fc90e05e423654f54f1`, not the tested local candidate. They are ancestors
of the local PR1/PR2 commits (141 and 172 commits ahead respectively), so no force-push is
currently indicated. PR1 also contains the currently reported upstream base commit
`3c49a73021ab4c660bced03ae4281db5a4b36cd8`.

PR2 still has 55 modified, 15 declared deleted and 84 untracked files, no staged/unmerged
entries and a passing whitespace check. The untracked runtime/catalog/CI helpers are required
by tracked imports and workflows; a tracked-only commit is not a valid candidate. No private
development-host literals or companion-app-specific logic were found in changed model/app
production source. Historical app-specific release documentation remains historical evidence.
PR1's full working-tree inventory remains blocked by mixed ownership; no trust exception or
ACL change was applied during these checks.

The remaining hosted step requires authorized final stacked commits and normal pushes to
the two existing PR branches, after a narrowly scoped PR1 Git trust approval. No commits,
pushes, tags, PR edits, production activation or hosted workflow dispatch occurred here.
Private local receipt: `admin/final-pr-checks-20260915.json`. Frontend result SHA-256 values:
PR1 `485bb7f1f94b4c59b369b9bdb3eaaf1c79d17da8f76ab2968b3652398ebc9197`;
PR2 `35aafaee71bb757fb5e19528d5c37f95d7270a8fae5fc58f0f29dbcf1eb111b9`.
Phone acceptance is recorded below; the separate known broader image-note mismatch is not
converted into a pass by these contract tests.

## Smaller-model choice and diagnostic retirement — September 14

The user selected the existing approximately 1.7 GiB all-q4 Qwen model with its tested,
app-owned prompt and requested removal of the mixed-precision weights. The mixed-only
generated local package and its temporary download route are retired; shared base-model
files and historical evidence are preserved. Built-in catalogs continue to expose the
smaller Qwen and Gemma. No custom mixed-model hosting or redistribution decision remains.
No host runtime or model-default change was required for this retirement.

The companion app's live configuration and verification binding now exclude the mixed
model profile. That app's tests and captures remain in its own repository. Historical
mixed-model phone results below are not relabelled as smaller-model results. The new
smaller-model desktop screen has one known heading/subtitle mismatch; retained historical
transport warnings are not a clean-runtime acceptance claim. Current phone, optional-audio,
broader accuracy and exact-final-commit hosted checks retain their separate scope.

The post-move worktree links were repaired with the user's approved one-command trust
exception. No global Git trust, ACL, history or branch changes were made. Normal owner-context
PR2 inspection now works: 55 modified tracked files, 15 declared deletions and 84 untracked
files; nothing staged or unmerged, and the whitespace check passes. PR1 is an ancestor of
PR2 (0/75 commits), but its working-tree inventory remains blocked by mixed ownership and
must not be inferred from branch ancestry. Existing changes must not be blindly staged/restored.

### Current physical-phone setup — September 14

The cleanup APK above was installed in place on the connected physical phone. Its packaged
`/version` reports `2.0.0-local-webgpu-cleanup-20260914` at `http://tauri.localhost`; the signed-in
account and chat list survived. The normal catalog UI restored the packaged `2026-09-default`
catalog (smaller Qwen and Gemma), clearing the retired diagnostic-server source. Only the mixed
model's retained download was deleted; its cache is now absent. Both other model caches survived.

The smaller Qwen cache was older than the current package: it had 13 model artifacts, two old
graphs, and no DeepStack tensor. Normal chooser activation verified/reused the unchanged large
weights, refreshed the two packaged graphs, and requested the pinned 151,080,960-byte public
source range for the 302,161,920-byte derived vision tensor. Activation then completed with
14/14 artifact metadata matches, 17 total cache entries, and the cleanup worker hash
`04ebc7bcb6a5385745a095ace2ba87e3e474775775dbae31f74d165433b39bd8`.
Gemma remains downloaded (16 cache entries, 13/13 model-artifact metadata matches).

The UI now selects smaller Qwen with Model only, all three sessions on WebGPU/q4 and a 96-token
ceiling. There is no OCR/model fallback, and optional voice support remains optional. Fresh
physical-phone image/card acceptance is still pending; install/cache checks are not inference
results. The private local checkpoint is `admin/phone-smaller-qwen-release-20260914.json`.
No entry was submitted and this setup checkpoint alone does not qualify inference or release.

September 15 follow-up: all three requested smaller-Qwen image proposals in the current physical
APK passed the companion app's field assertions (six, seven, then six). The second and third
ran without restarting or changing the model; the third repeated the initial image.
App-authored frames rendered and host confirmation was enabled; no entry was submitted.
WebGPU prompt/vision/decoder execution, prompt-session retirement and decoder teardown
completed for all three runs, with zero remaining page workers after each completion.
No model-weight download was observed during inference. The subsequent-token “cached CPU
facade” only carries token IDs and tensor shape; learned embedding computation remains in
the WebGPU decoder, with CPU provider fallback disabled. App-specific values and evidence
remain in the companion repository/private local receipt, not host-domain fixtures.
A separate pre-inference WebRTC navigation error is recorded rather than suppressed. The
previous repeated-use crash did not reproduce in this sequence; the result does not guarantee
all inputs or unlimited repetitions. Broader accuracy, optional audio and final release gates
remain separate. Actual private runtime evidence has SHA-256
`f1287a2e187e38eb7a97190dde59a256855b2449a7449e1cf2ce0932cda1c37b`.

## User-directed inherited-advisory deferral — September 14

The user requested: “document and skip Inherited-advisory decision.” The ten
existing findings are therefore documented and deferred for this scoped local
preparation task. No further approval or remediation decision on these inherited
findings is required from the user to continue that work.

The original PR1/PR2 OSV reports, classifications and failed advisory check results
remain intact. This deferral is not a clean scan, a claim that the findings are
harmless, or a change to upstream CI/release policy. No advisory suppression,
dependency upgrade, core edit or scanner-gate change has been made. Any upstream
review of the recorded findings remains visible in the handoff.

## Approved PR1 advisory check — September 14

The later explicit user approval resolved PR1's permission blocker for the requested
payload and OSV destination. The fresh scoped run completed one authenticated request
for **481 selected identities**, including seven Git packages, with no unqueried
identities. Collection, reviewed scope, unchanged inputs, official SBOM validation
and complete response checks pass. It returned exactly the same ten
advisory/package/version tuples as PR2, with no additional findings.

Nine are maintenance notices; the RSA vulnerability appears only in the selected
Windows integration-test context. The [existing bounded triage](rust-feature-advisory-triage.md)
applies to the identical package identities, not to unexamined runtime reachability.
The conservative advisory gate remains failed; no exception or dependency change was
introduced. The completed PR1 summary is `output/rust-feature-ci-xLvzhv/summary.json`,
SHA-256 `64824d53be0ca74e591b374802d1bf280326891bd1bf35e2aeef9a486a615a95`.
The current APK phone qualification and final exact-head hosted checks remain
outstanding. Inherited findings are now documented/deferred per the later user
instruction above. Private-catalog Qwen remains available for local testing; public
hosting is a publishing concern, not a prerequisite for local APK tests. This follow-up
does not change core code, model settings/cache, APK, servers, commits or publication.

## Exact-source advisory follow-up — September 14

Both slices now bind selected Git packages to OSV queries using their resolved
immutable commit, without substituting same-name registry releases. Shared-commit
crates retain separate source-package provenance. Mixed-source pagination, changed
commits, Git-only findings and rejection of the former registry-only mode are covered.
The scoped Rust script tests pass: PR1 **261/261**, PR2 **263/263**; both structural CI
checks pass. No core source, app semantics, model settings or APK changed in this step.

The two live-check requests received different permission decisions. PR1 was rejected
before execution because the approval did not explicitly cover potentially private
Git commit metadata sent to OSV; it has not been retried. PR2 was allowed and completed
one authenticated request for **496 selected identities**, including seven Git packages.
Its collection, reviewed scope, source stability, SBOM and complete responses pass;
there are no unqueried identities. **Ten advisory findings prevent advisory-gate
acceptance**. Their [bounded triage](rust-feature-advisory-triage.md) identifies
nine unmaintained-package notices and one RSA vulnerability in the selected
integration-test helper. All ten exact versions and checksums already occur in
both pre-PR lockfiles; this is not an exploitability assessment or waiver.
None were returned for the seven Git queries;
this does not prove fork indexing or security. The completed PR2 summary has SHA-256
`87dc8a9af5a043a7c73e78721d4dc3bc7425c341b1494a769031a7104dad2aee`.
No further live request is authorized by this result. Release acceptance remains
incomplete, including the existing current-APK phone and catalog-distribution gates.

## Model-cleanup verification follow-up — September 14

The current source now includes a narrowly scoped Qwen cleanup refactor in both slices.
Success returns and cleanup-only throws occur after cleanup blocks; original native errors,
tensor ownership, disposal attempts and release ordering are preserved. Nine additional
error-identity cases cover non-Error throws and secondary disposal failure. The 123 affected
tests pass before and after the refactor. No model settings, prompts, app semantics or
dependency roots changed.

The selected frontend suites pass with native exit code zero: PR1 has 49 files / 972 tests;
PR2 has 86 files / 1,782 tests, with no failures, skips or todos. Read-only scoped runtime lint
and frontend type checks report zero errors in both slices; unrelated existing warnings
remain. The actual production model-worker target builds successfully to an isolated temp
output. The source-review fingerprints are refreshed for these reviewed model-only edits;
the additive app source fingerprint is unchanged.

The cleanup APK is now built as `OpenChat-local-test-cleanup-20260914.apk`,
version `2.0.0-local-webgpu-cleanup-20260914`, SHA-256
`d5e28646738a8d7c79d022d00ec0f4cad0194e08f607ed4b2f0af65d2735529c`.
The canonical local ARM64 build passed in about 8 minutes 45 seconds, with unchanged
sources/locks and the existing local identity profile. Its packaged model worker exactly
matches the independently emitted worker at SHA-256
`04ebc7bcb6a5385745a095ace2ba87e3e474775775dbae31f74d165433b39bd8`.
The source-bound launcher now records existing declared deletions explicitly; all 15
remained unchanged. No core files were restored, edited or removed.

The installed emulator APK passes cold startup at 4.2 seconds, all 26 packaged-asset
checks, ORT factory/WASM loading, worker disposal, and source catalog/version equality.
It remains on the local packaged origin with OTA disabled. The first harness attempt
failed before browser inspection because its cached Playwright dependency link was
missing. Only that exact existing-package link was restored; the failed receipt is
retained, and acceptance comes from a separate fresh cold launch.

**GPU inference is not accepted by the emulator check.** WebView 152.0.7977.87 exposes
`navigator.gpu` but returns no adapter for default, high-performance or low-power requests,
reporting “Failed to create WebGPU Context Provider.” It reports a secure context and
zero GPU-process crashes; its diagnostics report Vulkan support as false. The exact
driver/native-bridge cause is not isolated. As
[Chrome's diagnostics distinguish](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips),
API presence alone does not establish a usable adapter. No experimental flag, renderer
switch or software inference fallback was used. The emulator was gracefully stopped.

No phone is connected for new-APK inference verification. Earlier phone evidence below
belongs to the earlier APK, not this cleanup artifact. No server deployment, advisory
query, commit or push occurred in this packaging follow-up; remaining release gates stay open.

## Current configurable WebGPU model catalog

September 14 local-test update (supersedes the deployment blockers in the historical
September 13 checkpoint below): the replica was recovered with explicit approval and without
resetting canisters. Matching local frontend services and the external app's configured
manifest/binding are active. The rebuilt catalog-enabled local APK passed emulator startup
and all 26 installed-asset checks, then was installed over the existing physical-phone APK
without clearing account or model data. Shipping signing/publication remains publisher-owned.

The first physical-phone proposal exposed a partner-backend contract gap: the partner's
initial-card deserializer did not accept an evidence field emitted by its own new normalizer.
Reconnect could not repair that mismatch. The fix is partner-owned; no OpenChat verification
bypass, domain-field logic or model/prompt change was introduced. Sixteen exact current
host-produced cards now pass the actual partner attestation predicate, with negative controls
for invalid evidence and final-confirmation leakage. Previous form-only replays missed that
backend boundary and must not be described as live attestation evidence.

After an explicitly approved, state-preserving partner-backend upgrade, two fresh Gemma
physical-APK image proposals opened verified app-authored cards successfully. Source facts,
calendar date/range, private saved-Type selection and its configured direction were inspected
in the rendered card frames. Neither was confirmed by the agent; both now display cancelled.
This does not qualify delivery, unseen-image accuracy or the entire phone matrix.

The physical APK has also accepted an explicit HTTPS catalog refresh adding the separately
pinned mixed-precision Qwen candidate alongside the existing models, with no APK/code change.
Its normal Model Manager download completed and the candidate is selected with all three
learned stages on WebGPU (FP16 embeddings, q4 vision/decoder). Gemma remains downloaded;
read-only inspection also confirms the older model cache remains present, without claiming
that it satisfies the newer built-in definition. The first fresh candidate phone proposal
also opened a verified card with correct amount, currency, calendar date and source note.
Its trace records completed decoding and decoder cleanup with no observed GPU error or
filtered model-weight network request after download. The first observer's worker-name filter
was incorrect, so that trace does not establish worker creation/closure counts. Under a corrected
passive observer, the range-image proposal and original-image repeat also opened verified,
factually correct cards, including the app's private saved-Type direction and full date range.
These three consecutive proposals used the same APK session. Both subsequently observed
workers closed after decoder cleanup, with no observed GPU error or filtered model-weight
network request. The original model caches remain present after the repetition.
The subsequent Qwen/Gemma cache-switch round trip passed too: initial Gemma activation
verified its retained bytes locally, then both return switches attached without re-downloading.
A fresh post-switch Gemma image proposal opened a verified, source-correct card and its
worker closed after decoder cleanup. The optional audio add-on remains uninstalled. Earlier
Qwen cards now display cancelled; no proposal was confirmed by the agent.
Private model transport serves only allowlisted artifacts and
the catalog. Runtime code, artifact identities, prompts and source transforms are unchanged.
Remaining acceptance: applicable optional-audio checks, broader source accuracy, authenticated
delivery, feature-scoped Rust source/advisory acceptance, final source/PR hygiene and exact-head
hosted checks. The full feature-CI checker now passes the actual scoped workflow wiring in both
slices. Both slices now have validated bounded source-review receipts and fresh successful
offline collections. No live advisory acceptance is claimed.
No whole-core audit or safety-guard waiver was performed. No final-stack push or release publication
is claimed.

## Completed bounded Rust source reviews — September 14

PR2 now records the completed additive app/card owner review in
`scripts/rust_feature_review.pr2.json`. The final pass bound 59 supporting sources:
card identifiers/wrappers, nested HTTP/metrics values, configuration/guard leaves,
cache-policy calls, and changed module/job/test registration. It introduced no
dependency root, profile, runtime, app prompt or model-default change.
The receipt covers 347 source files, 255 seeds and 436 seed/profile pairs in 67
review units. The original inventory remains intentionally incomplete; the
separate validated review closes its bounded source-review gap.

Fresh installed-Cargo offline collection passed all seven PR2 profiles with
unchanged inputs and empty Cargo stderr. All raw metadata and selected package
identities match the retained pre-receipt collection. The selected SBOM contains
496 components and passes its official schema/identity validation.
The actual workflow contract and 487 relevant policy/validation tests pass,
including stale/missing source-review evidence controls.

Evidence: `output/rust-feature-collection-BoOmDU/summary.json`, SHA-256
`0b884e746cd0647bfb38e1d7a04f83c5c90914e69121ff43084b3fbeffd9e94b`.
This supersedes the historical PR2 source-incomplete statements below, not
advisory, model-accuracy, delivery, APK or hosted-CI acceptance. PR1's separately
recorded five-profile review remains valid. No advisory request, deployment,
commit, push or phone change was performed in this follow-up.
Remaining release work includes exact-source advisory coverage/authorized
queries, the model-distribution decision, and final stack/functional/hosted checks.

## Current scoped Rust profiles — September 14

The local ARM64 all-WebGPU profile is now explicit in both owning configurations, separate
from historical native-inference/store and publisher configurations. PR2 rebinds 13 inherited
model/IPC/build roots to its current source and lock identities and adds its four existing
mobile app/cache-policy roots. Seven model/build files match between the checkouts; the
current plugin manifest and command ordering were checked separately. No desktop `open`
call, backend fixture, host-test or optional native-inference root is added to this local
profile. This composition does not qualify every other PR2 profile as the complete inherited
model/native union.

PR2 also records the release hash guard's three external edges in isolated Windows/Linux
host-tool profiles. They are build/tool context, not deployed canister roots. Cross-target
metadata produced on Windows does not establish native Linux execution.

Fresh `cargo metadata --locked --offline` completed all **5 PR1 + 7 PR2** profiles with exit 0,
empty stderr and unchanged source/lock inputs. Both local all-WebGPU graphs resolve exactly
`open-chat/transformers-webgpu-android`, no plugin features, and no llama.cpp, Minijinja or
devtools node. The selected local closures contain 13/17 roots and 311 external packages each;
this is not a whole-repository audit or a compiled-binary inventory.

- PR1: `output/rust-feature-collection-0TwW8n/summary.json`, SHA-256
  `e74b2f7aa4d353bf3de7d2789faf5613db63dcd994b10493f0a34e25f9245e93`.
- PR2: `output/rust-feature-collection-oaJbEE/summary.json`, SHA-256
  `375ded9ad4420749c62ac89d08dd9dc8e30b49392932a9ffabbafcff78b22bd2`.

The three focused scope/seed/collector suites pass **45/45 and 46/46** respectively; CI/scope
safety suites pass **109/109 and 150/150**. A failing-first regression caught the absent local
profile, and source validation caught an omitted PR2 command pin before the final run.
Existing pins, seeds, profiles and explicit incompleteness limitations remain intact.
These offline results do not clear advisory/licence acceptance or the legacy Rust/SBOM
workflow migration. Both full feature-CI checks still fail on that legacy command.
No runtime, app prompt, APK, account, canister or production service changed in this follow-up.
The final catalog-default/distribution choice is also pending: the phone-tested mixed Qwen
candidate is supplied through an operator catalog, not the older bundled all-q4 entry.

### Shared-test and CI-trigger follow-up

Both model workflows now include `scripts/rust_feature*` in their trigger paths, and the
workflow contract rejects its removal. Both scoped Rust configurations add precisely two
caller-side group-index upload schema edges used by the shared feature-test setup:
`candid` and `serde`, normal Cargo dependencies consumed in test context. They are selected
only for `windows-default`, never for the deployed canister or Android profiles.
The pinned helper/schema/primitive-alias review does not select unrelated API siblings or
group-index implementation dependencies.

Failing-first checks caught the missing entries and trigger. All five focused scope/CI safety
suites now pass **155/155 (PR1)** and **197/197 (PR2)**, including shipping/Android-leakage
negative controls. Fresh offline metadata completed all 12 profiles with status 0 and empty
stderr. Current source inputs and output receipts were rehashed independently; all prior
root objects are retained, with only the two test entries added per scope and unchanged
per-profile package counts. The local WebGPU profiles remain at 13/17 roots and 311 packages.

Current receipts for the updated configurations (the earlier receipts above retain their
original configuration identities):

- PR1: `output/rust-feature-collection-56VJAc/summary.json`, SHA-256
  `92268faabf8c0c97e0613ae44fcf0b7a9591030c9a7888a3abf19253a9427140`.
- PR2: `output/rust-feature-collection-M0RL3b/summary.json`, SHA-256
  `964c48ddec3ae7b053d9ae14b0874664c90e5c501967bfed33fda9b24270575c`.

The full CI check still rejects the legacy Rust/SBOM commands. No live advisory query,
whole-core audit, acceptance waiver, runtime/prompt change, APK update or publication
occurred. Model distribution and final exact-head acceptance remain pending.

### Offline selected SBOM schema gate

The collector now validates its output against pinned local copies of the
[official CycloneDX 1.6 schema](https://cyclonedx.org/schema/bom-1.6.schema.json)
and its SPDX/JSF references before accepting the SBOM export. Schema retrieval is not part
of CI: copies, source URLs, licenses and serialized JSON identity pins are versioned under
`scripts/vendor/cyclonedx-1.6/`. Validation uses the already-locked Ajv 6.15.0 development
tool, with installed version and lock-integrity checks; no dependency manifest/lock changed.

The selected-export validator also rejects duplicate/missing component identifiers and
broken dependency references. It supports the exporter's ASCII URI-reference/contact subset
and rejects unsupported values rather than skipping format checks. Unicode property text
is retained. Draft-07 reference semantics are preserved; Ajv's two informational warnings
concern a redundant object type and annotation siblings, not ignored instance errors.

All exporter fixtures exercise actual schema validation. All offline feature-policy suites
pass **440/440 (PR1)** and **525/525 (PR2)**, including 24 validator cases per scope, collector
receipt checks, suite-omission checks and vendor-trigger negative controls. The real selected
exports validate too: **481 components (PR1)** and **496 components (PR2)**.
Their exact SBOM SHA-256 identities are respectively
`0a47262907241043a5071c9bae7473d9ded18de8956c0202ea606dddb4cbc53a` and
`3bf3744f9d644fb94f620f24a1ea189e38f3cea0a3c629e9679a495354eea381`.
Original collection receipts remain unchanged; no new large metadata copies were generated.

New collections write `selected-rust.cdx.validation.json`, bound to the SBOM hash, and set
`officialSbomSchemaValidated` only after validation. Advisory, source-completeness and
release flags remain false. The legacy Rust/advisory workflow migration, model-distribution
choice and final exact-head checks remain open. No core audit, runtime/model change,
APK update, deployment or publication occurred.

### Shared schemas and generated owner follow-up

The caller-side shared setup/upload/subnet/registration schema review is now recorded in
both slices. Three user-index registration roots are Windows-test-only; the generated
ts-rs consumer edge was previously omitted in PR1. Seventeen supporting/helper sources
were added per slice, without selecting unrelated fixture implementation behavior.

The bounded PR2 app-state pass also added nine source pins: five user-index
token/throttle schema files and the app-only Data fields in group, community, group-index
and local-user-index. Their declarations/default paths retain the existing nested card,
identity, entropy and byte-buffer owners. The regression then exposed two missing generated
Data-to-Serde edges, in group and community. These are now explicit normal/production roots
for wasm-default and windows-default only. The Serde package was already selected; no native
or mobile root/package was added. This does not review every old field of mixed core Data.

Regression controls now reject loss of those pins/owners, mobile profile leakage, and loss
of any pinned direct ts_export consumer's own ts-rs dependency. The macro's emitted derive
does not incorrectly assign that consumer dependency to the macro crate. This bounded
text regression is not a Rust parser or a proof of arbitrary call-graph completeness.

All offline feature-policy helper suites pass **441/441 (PR1)** and **527/527 (PR2)**.
Fresh installed Cargo ran all twelve locked/offline profile collections successfully,
each with empty Cargo stderr and unchanged bound source/lock inputs. Both new selected
exports passed the mandatory official schema and graph checks: 481 and 496 components.
Every profile retains the same exact package identity set as the preceding collection.
The local WebGPU profiles still have 13/17 roots respectively and 311 packages each.

Current receipts (supersede earlier inventory receipts for these source/config bytes):

- PR1: `output/rust-feature-collection-EYJ9Zz/summary.json`,
  SHA-256 `573f059139153175655b743f62ae5c3f5d69fc44ecaab86f35ebe6752241310c`.
- PR2: `output/rust-feature-collection-bMSMns/summary.json`,
  SHA-256 `92a4cbb233370f7205e3c0a937c0485a0de2de50b16b86fdbb0b40e4296969df`.

These new receipts occupy 87,831,248 bytes under the project-specific temp directory;
no model weights or build caches were duplicated. No APK/runtime/prompt/partner code changed.
Remaining Rust-root review is bounded to changed feature paths and generated ownership,
not unchanged core state. The inventory is still explicitly incomplete and the full CI
checker still rejects the old whole-lockfile dependency-policy command. No advisory scan,
release acceptance, commit/push or deployment is implied. Scoped CI migration, model
distribution and final exact-head acceptance remain open.

### Executable scoped Rust CI composition

This follow-up supersedes the structural legacy-command blocker above, not source/advisory
acceptance. The actual workflows now invoke `scripts/rust_feature_ci.mjs`: PR1 in its model
checkout, PR2 once in its additive app/card security workflow. PR2 neither imports an absent
PR1 config nor claims the full inherited native/model inventory.

CI explicitly prepares locked metadata with Rust 1.95.0 before the retained offline direct
license gates. Broad Rust/SBOM modes and cargo-audit/cargo-cyclonedx installations were
removed from these workflows. The orchestrator itself installs nothing; it binds actual
offline collection, revalidates the official SBOM receipt, and stops incomplete source
coverage before any advisory egress. Complete coverage, authenticated current results and
no unqueried selected identities are required by its assessment. Release acceptance remains
a separate decision.

The workflow checker now requires exact executable scope/checkout/mode, strict ordered input
preparation/license checks, the full workflow check and non-ignored failure reports. Uploads
omit raw workspace metadata. Tests use actual workflow text, not a sanitized future fixture.

- Offline feature-policy tests: **492/492 PR1**, **578/578 PR2**, no failures/skips.
- Adjacent workflow/history policies: **40/40 PR1**, **85/85 PR2**.
- Both actual full workflow CLIs pass locally. Node 24.14.1 was used locally; hosted 24.18.1
  execution is not claimed.
- Both real compositions ran all five/seven installed-Cargo profiles successfully with empty
  Cargo stderr, unchanged source inputs and validated selected SBOMs. Both exited **1** at
  `incomplete-feature-scope`, with **zero advisory requests**. Synthetic complete-evidence
  assessment tests do not qualify the current incomplete-inventory producer.

Receipts: `output/rust-feature-ci-qObEVT/summary.json` (SHA-256
`dd6c1e2e25a7b3de1a736b450e007072913e7d81e77dbf382898628cb53b0327`) and
`output/rust-feature-ci-zwYbZG/summary.json` (SHA-256
`a28d9ceb4e91e9bc0172bed594c239f35f28f54c1dbc79c8f67716013ab7df2a`).

Twelve byte-identical raw metadata copies were retired after comparison with the preceding
retained collections, freeing **60,601,098 bytes**. All summaries, selected reports, SBOMs and
original metadata remain. The original CI manifests are unchanged historical records;
deleted duplicate paths are not silently rebound. The project-temp retirement map is
`admin/rust-ci-duplicate-metadata-retirement-20260914.json`.

The remaining work is bounded source review/completeness production, selected non-registry
coverage and authorized live advisory evidence, model distribution and final exact-head
acceptance. No core audit, local installation, APK/runtime/prompt/partner-code change,
deployment or commit/push occurred.

### Versioned source-review acceptance path

September 14 source-review contract follow-up: the collector now accepts a separate,
versioned [source-review receipt](rust-feature-source-review.md). It validates every
configured source and seed/profile disposition, exact owner/evidence references and all
gap resolutions against the pinned inventory. Stale receipts fail before subprocesses;
receipt drift invalidates an in-progress collection. The incomplete inventory API itself
is unchanged and still cannot grant completeness.

The positive path is exercised through actual collection/SBOM/CI code using offline
fixtures; fixture transport never grants real acceptance. All offline feature-policy
suites now pass **499/499 PR1** and **585/585 PR2**, and both full workflow CLIs pass.
No actual PR receipt was issued and no real Cargo/advisory run was performed in this
follow-up. Completing the substantive source review, exact-source advisory coverage,
model distribution and final release checks remains outstanding.

### PR1 bounded source review accepted

September 14 PR1 source acceptance: the actual versioned
`scripts/rust_feature_review.pr1.json` now records the completed bounded model-owner
review. Five previously unpinned module declarations are bound without adding any root.
The receipt covers **131 source files, 114 seeds and 200 seed/profile pairs** in 42
review units. The unrelated pre-existing DynamoDB worktree edit remains excluded.

A fresh installed-Cargo offline collection passed all five profiles, with unchanged
source bytes and an officially validated **481-component** selected SBOM. Its summary
reports `rootCompletenessVerified: true` and no unresolved source-review gap.
All per-profile package identities and raw metadata match the retained prior collection;
this is additional source-review evidence, not an expanded dependency scope.
Current receipt: `output/rust-feature-collection-PQNzna/summary.json`, SHA-256
`109f21ad1cb2eb4a5c9c3622f03b571ad4709a82892b62a8cf6ad568a43cb513`.
PR1's offline feature-policy suites now pass **500/500**.

The base inventory deliberately remains an incomplete inventory: the separately bound
review resolves it; no status flag was flipped in place. No advisory requests or actual
CI advisory run, model/default change, APK build, deployment, commit or push occurred.
PR2 source review, exact-source advisory coverage/authorization, model distribution and
final release acceptance remain open.

### Historical September 13 packaging checkpoint

September 13 follow-up: the native APK build exposed a browser-catalog import in Rollup.
Runtime asset constants now live in a pure build module, with a native Node regression.
The current model suites pass **662/662 (PR1)** and **668/668 (PR2)**; both type checks
remain error-free. Feature-only ownership now covers 52 model files and the same 18 roots.
The rebuilt worker's full text differs only by the ordering of independent string constants
and a source-map comment; historical GPU evidence stays attached to its original artifact.

APK packaging is not accepted: after passing the import stage it cannot read the local
replica's public key. Strict restart reports incomplete saved subnet state. The rejected
restart cleaned up its empty process; backup-first recovery needs explicit user approval.
No repair, emulator launch, APK installation or deployment has occurred in this follow-up.

IOU's source manifest and processor page now use app-owned JSON prompt/profile configuration
for the exact Gemma v15 and mixed-precision Qwen v20 IDs. This does not assign that Qwen profile
to the older all-q4 model. No OpenChat runtime/domain change was needed for app activation.
The app build, both type checks and **1,661 app feature tests** pass. Sixteen retained answers
pass the actual registered-schema -> host parser/runner -> configured app processor -> card
path offline, with five negative controls and no injected test prompt or network requests.
This is not fresh model inference, live registration, attestation, private direction/type,
delivery or phone acceptance. Matching host/app deployment and all those gates remain open.

Current evidence: project-temp `admin/catalog-native-build-checkpoint-20260913.json` and
`output/iou-registered-model-profile-final-replay-20260913.json` (SHA-256
`3f5f037b4c8a2c471c0277f3a50aa2917bbfbff0e73f83066c5e4889be0e0868`).
The older checkpoints below retain their original counts, sources and non-activation scope.

The model-only catalog implementation is present in both reconciliation worktrees.
Compatible model IDs/revisions/artifacts, removal/enablement, session precision, optional audio
and bounded generation settings are JSON-configured; Model Manager v1/v2 share import/refresh
controls. Apps retain their prompts and card semantics. New architectures still need a
supported runtime adapter. See [the operator guide](../webgpu-model-catalog.md).

Final checks: PR1 **661/661** and PR2 **667/667** model tests (32 suites each); both full
frontend type checks have zero errors (558/562 existing warnings). Independent production
worker builds match at 974,153 bytes / SHA-256
`131557a3edb11a51f227c7cca76e4d90739d14a0152ba0e517cbefffd68916be`.
Real Chrome component checks in both worktrees pass file import, custom ID/settings,
invalid import, reload persistence, empty catalog/removal, retained CacheStorage, explicit
server refresh and 390px/desktop width checks. No model weights are used in those UI checks.
The final bootstrap tests catch positional/default-model assumptions; adapter asset packaging
does not depend on the active catalog. These are not full-app or physical-phone checks.

Model CI selection/trigger and direct-root ownership checks are updated. All 18 model
dependency roots remain unchanged; the inventory now includes 51 source/evidence files.
PR1's combined offline CI/ownership selection passes 155 tests. PR2 initially rejected two
app-scope source fingerprints; the separate current app review now accounts for the four
changed files (runner, processor, shared contract and model-owned Rollup) against the prior
per-file identities. All 44 app paths and 17 direct dependency roots/anchors remain unchanged,
with no added import target. The combined PR2 offline selection now passes **213 tests**.
Current app contract reruns pass **479 OpenChat tests** and **295 focused partner-app tests**.
This is scoped source/dependency ownership and contract evidence, not an advisory/core audit,
full-app execution, accuracy or phone acceptance. See project-temp admin
`app-root-source-review-20260912.json`.

Evidence: project-temp admin `catalog-pr1-port-receipt-20260912.json` and
`catalog-model-source-review-20260912.json`; UI results under
`output/playwright/catalog-ui-pr1-9FlaYz` and `catalog-ui-pr2-YEvmdV`.
The initial copy receipt precedes the final symmetric bootstrap/packaging correction.
Existing dirty changes were retained. No commit/push, server deployment, new APK, prompt
activation or new model accuracy/phone acceptance is claimed. The earlier hardware results
below retain their original source and worker hashes.

## Native-cache delivery follow-up: desktop checks pass, phone/APK still pending

The exact qualified candidate is now materialized locally: 627,834,676 derived model bytes
and the unchanged 974,153-byte worker. Unchanged large weights are referenced in place rather
than copied. The separate catalog/allowlisted manifest are not activated or deployed.

The shared catalog and production Model Manager APIs stored and verified the complete
2,259,712,165-byte model in native Chrome CacheStorage. The final continuation independently
reverified that cache without another initial download. Eight checks pass: import/readiness,
cold model/runtime-cache verification, four sequential hardware-WebGPU calls and worker
closure, removal/restoration without deleting weights, same-size corruption rejection,
one-file repair and bounded request diagnostics. No model request occurs during inference.
Browser and server exit cleanly.

All four new answers pass unchanged source checks and actual offline host/app card-field
replays. This is three previously exposed images plus one repeat, not unseen or phone
acceptance. JSON-only remains 0/4 because complete enclosing fences are accepted by the
existing strict host parser. No prompt/profile activation or production-code change occurred.

- Runtime: project-temp `output/playwright/model-delivery-cache-60eCSh/result.json`,
  SHA-256 `85105979064c93c526a83d03012e03126a0610551f153e03fdf2081ab6228b54`.
- Separate source/card assessment: `b955d3b55929bf9052a0f3f864706dc43a621d74e45c967385ae972ac99c36e0`.
- Frozen plan: `bc80d3826cec795fd159effaeca2e2b84a63e7e1e7900e1c181f6541434e4b49`.

Earlier failed harness records remain unchanged: one sampled worker-close events too soon;
another misclassified Chrome's completed CacheStorage stream notifications. An independent
eight-case probe reproduced the notification with exact received/stored bytes and digests.
The final test waits for actual closure and allows only the proven, fully verified small-file
repair notification. Inference failures and byte mismatches still fail; no accuracy oracle
was loosened.

Remaining gates: served phone catalog, updated local APK/emulator checks, physical-phone
repeats/memory, broader images, optional audio, and live app verification/type/direction/
delivery. No USB device was present. No commit, push, deployment or APK update occurred here.

## Qwen eight-image checkpoint: source/card cases pass, device/release gates open

A fresh run of the original-key complete-row prompt passes **8/8 exact source checks
and 8/8 current-host/actual-IOU card-field replays**. The prompt is app-owned. IOU opts
into a declared `total-row` profile, separating a bounded printed label from one complete
money value while retaining the strict default `total_text` contract. No OpenChat source
changes, OCR, fallback, second image pass or corrected source/card expectations are involved.

The same final worker and mixed-precision Qwen candidate are used: FP16 embeddings/head,
q4 vision/decoder, 96 output tokens, fresh worker per image, hardware WebGPU throughout.
All runtime/buffer-retirement checks pass; browser, loopback server and child exit cleanly.
JSON-only remains 0/8 because complete enclosing fences are returned; the strict host parser
accepts those complete JSON envelopes, with key order and source/card fields passing 8/8.

This v20 configuration keeps the v18 prompt bytes unchanged. The intervening v19 key-only
rename (`total_text` to `total_row`) passed runtime but regressed Arabic payment kind and
receipt heading: **6/8**, rejected. The original v18 diagnostic recovered receipt currency
but failed its old money-only format (3/8); that historical report remains unchanged.
Its retained answers fit the new declared profile offline, separate from the fresh v20 run.

- Prompt: `2d73ebab0701a7adb4256072ef4625c30964b46766172bae05602bc72e045cc8`.
- Pre-inference policy: `4c0cae4300f71df01309bc596cb3a44024a6da3e2937c3a1fe9ea8357f829e28`.
- Plan: `a1bf0814e315d810f55b4403a4dfce70806f318a1ec947d54c73f2c390fd402c`.
- Runtime: project-temp `output/playwright/catalog-qwen-row-8HVeSi/result.json`,
  `c5404f050bbd50953dd69b67ffaf201964eb50f27dc9e064be69f7c3c7555b3d`.
- Assessment in that directory: `ab0902f12750b129154ff706f1d7c2236de43e3f4849d75133f9a90da53c3579`.

IOU retains the actual captures and nine additional replay tests; its whole feature suite
passes **1,622 tests** including those additions. Both IOU TypeScript configurations pass. The
app profile is opt-in infrastructure only: no manifest/page activation, server deployment,
new APK or model-weight publication occurred. That eight-image run generated the table in
diagnostic memory; subsequent native-cache delivery evidence is recorded above.
Broader/unseen accuracy, physical-phone repeats/memory, served phone delivery, optional audio,
live attestation/private type/direction and saved delivery remain separate release gates.

## Previous Qwen prompt checkpoint: seven of eight, not qualified

The app-owned v17 candidate changes only the title and total-row instructions from v16.
It runs the same eight source images on the final catalog-bootstrap worker
`131557a3edb11a51f227c7cca76e4d90739d14a0152ba0e517cbefffd68916be`, with the unchanged
mixed-precision embeddings/head, q4 vision/decoder, 96-token cap and one image pass.
All runtime/GPU retirement checks pass and the browser/server/child exit cleanly.

Exact source and actual offline host/app card-field checks improve from 6/8 to **7/8**:
all titles, dates and payment kinds are correct; the paper receipt still omits its printed
currency. Its amount/date/title/kind are otherwise correct, and the unchanged card gate
rejects the missing currency. JSON-only remains 0/8 (complete fences); key order passes 8/8.
No label stripping, source correction, OCR, fallback or second image pass is used.

Result: `output/playwright/catalog-qwen-f16-candidate-N1RPhK/result.json`,
SHA-256 `432f2ceb947b58bdf17e42722c97c43d2769adddf55f65c41dc43f35f994716d`.
Assessment in that directory: `b484c84a29bfe4357a584b45009b98e832cf8600defa7c045e3bc34ef2a0af49`.
Predeclared plan: `80856d17cfb0abbf6fde0428e4a0447692e5d4c31a2aa06a976c69095e15d04e`.
Five runner/scorer tests verify that the final worker pin is the only runtime/oracle binding
change; all source/card assertions remain intact. The model table is generated in diagnostic
memory only, with no new weight file or download. No prompt/registration, server or APK is
activated. This was the best mixed-precision checkpoint at that point, not broad or phone qualification.

## Current generic model-prompt selection

PR2 source now supports the additive app-authored `x-openchat-image-prompt-by-model` extension.
Only actual image requests select a template by the supplied opaque model ID. Invalid/unknown
maps retain v1 behavior; text, private-reader verification, existing focused-pass admission,
post-rules, schema validation and card checks remain unchanged. No partner-specific prompt or
field logic was added. See [the protocol and bounds](../local-app-processing.md#app-owned-image-prompts-per-model).

The new 11-test selection suite and existing 260 action tests pass (271 total); targeted
TypeScript semantic/syntactic checks for the changed source/test and ESLint pass. The exact
16 KiB aggregate test first failed because its fixture exceeded the separate per-template
cap; distributing the fixture bytes across valid entries repaired the test without changing
the production limits. No image inference, registration, server deployment or APK build is
claimed by these interface tests. App prompt accuracy still requires separate qualification.

## Current generic raw-output normalization

PR2 now supports atomic per-model map version 2 with explicit `output: "app" | "canonical"`.
The new app-output path strictly parses complete bounded JSON and invokes the registered
processor once, before canonical rules, conformance and required-field checks. The image-only
`normalize_raw` operation requires source-index bindings and preserves candidate count/order.
Missing capability or incompatible focused passes fail before inference; app rejection,
malformed data, timeout or changed context prepare no card or repeat image inference. Legacy
image/text/audio/private-reader paths remain unchanged. See the
[version 2 protocol](../local-app-processing.md#version-2-app-normalization-before-canonical-validation).

The focused host/shared/runner/processor selection now passes **473 tests**, including raw-field
preservation before canonical validation, exact-once normalization, failure/timeout/batch
bounds and rejection before attestation. Scoped type checks and lint pass. The partner app's
focused suite passes **365 tests**. A direct current-source host -> actual partner processor ->
canonical card payload/form replay passes eight captured cases with no network or submissions.
This is not live attestation, rendered iframe, account/private-type or phone qualification.
Five of those tests add explicit caption, unknown/absent-model and text-only dispatch coverage:
captions are inlined exactly once, raw fields reach the app unchanged, and legacy fallbacks do
not invoke raw normalization. Scoped TypeScript checks and ESLint pass for the new test file.
No raw prompt was activated in a registration; no server or APK was updated.

A subsequent partner-app unit suite now passes **399 tests** across eleven files, adding
captured-output -> processor -> card saved-Type direction replay (both configured directions,
source-field retention, confirmation payloads and manual-edit preservation). This remains
offline unit evidence, not real private-grant/reconnect or delivery qualification. No new
partner-specific host logic was needed.

## Current per-model accuracy gate

Two subsequent eight-image prompt comparisons on the same mixed-precision configuration also
fail accuracy qualification. V16 changes only the v10 heading declaration: it corrects the
paper heading but still omits EGP and appends the English amount to its heading, leaving
source/card acceptance at **6/8**. Reusing the complete earlier question-style v14 prompt
corrects all headings but scores **3/8**: it drops printed currencies, includes total labels
and again calls the workshop completed payment. Neither prompt nor precision configuration
was activated. Both runs pass all eight runtime/retirement cases, clean process shutdown and
unchanged-source checks; JSON-only is 0/8 and key order 8/8 in each.

The new diagnostic is data-configured for bounded hash-verified four-field prompt experiments;
it preserves the actual current worker, model configuration, eight images, 96-token ceiling,
one pass per fresh worker and exact source/offline card expectations. Six new tests pass,
including exact one-line prompt reversal, wrong-digest rejection and the known English/receipt
negative cases. A pre-inference test caught an unintended extra trailing blank line in v16;
it was corrected before its pinned plan and any model run. The same complete scoring function
is reused, changing only exports and candidate output-directory admission.

- V16 result: `F:/Temp/OpenChat-IOU/output/playwright/catalog-qwen-f16-candidate-zP8G3S/result.json`,
  SHA-256 `5c7de7dbec4da309c239d49eebcf849424eaf294ffaf98b06954afed6030bbde`;
  assessment SHA-256 `aab2819986d6c6e8b848fc71c2479ab25baf0d82d506e280480e0d0377997c3b`.
- V14/FP16 result: `F:/Temp/OpenChat-IOU/output/playwright/catalog-qwen-f16-candidate-rmJc22/result.json`,
  SHA-256 `68db683ef4385dd9be2075b5a78d91db322d64ca74f98b01d2fd4c6bb6ef8377`;
  assessment SHA-256 `70b728069d576101883eca7d2520fb7f4fabf2256cc55d047641e47caa1a402d`.

The physical-device check during this work returns no attached ADB devices. The current PR1
checkout still has no model catalog; its read-only mixed-owner Git inspection succeeds using
an approved command-scoped trust exception, without global configuration/ACL changes. PR1
HEAD remains `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b` with existing model-file edits.
The verified catalog must still be ported by model-only scope and tested independently there;
do not overwrite its dirty runtime files or copy PR2-only app logic. No server/APK or PR head
was updated. Accuracy, scoped stack integration and physical-device gates remain incomplete.

A subsequent full eight-image run of that same configuration is **not accuracy-qualified**:
runtime/retirement passes 8/8, but exact source fields and current-host -> actual app ->
offline card-field replay each pass **6/8**. Every date and payment classification passes.
The workshop classification is corrected, but the English transfer newly appends its amount
to the heading. The paper receipt still merges the subtitle into its heading and omits the
printed currency. Money passes 7/8 and headings 6/8. These errors fail both the source and card
gates; no label stripping, currency default, oracle change or model fallback repairs them.
All eight answers are complete fenced JSON (JSON-only 0/8, requested key order 8/8).

The unchanged current worker runs one inference on each original image, with a fresh worker
per case, the same configuration and app-owned v10 prompt. All observed GPU buffers retire;
there are no runtime, browser or transport errors, and the owned browser/server/child exit
cleanly. The isolated test-cache transport does not establish real CacheStorage, repeated
same-worker use, phone memory, live attestation/private Type/direction or delivery. The offline
replay supplies the new opaque model ID through the actual host/app boundary and checks one
inference callback and one app normalization per case. No prompt/configuration was activated,
new model assets downloaded/copied to disk, or server/APK updated.

Full result: `F:/Temp/OpenChat-IOU/output/playwright/catalog-qwen-f16-eight-3MQidZ/result.json`,
SHA-256 `4d6e4375e7f53744004fad9a9fb9e0d3ea433b8d25ebcd9704d922d64628dfed`.
Source/card assessment: `F:/Temp/OpenChat-IOU/output/playwright/catalog-qwen-f16-eight-3MQidZ/assessment.json`,
SHA-256 `8112098cdd5b565724ff42ddd1122961eff38a512fcc9da52996b8f58f75904b`.
Predeclared plan: `e1c27b99d5fa8b33f7ee2553497eaee6a618229e6aca4555ce45c5944c8f9fb9`.
Six new runner/assessment tests pass, including wrong image/output bindings and missing GPU
retirement rejection. This supersedes the one-case scope below, not its historical receipt.
The candidate remains rejected for activation; the next accuracy work is app-owned prompt
selection on the verified runtime, including the newly exposed heading regression.

A full one-image hardware-WebGPU run now passes the workshop case using the current
catalog-enabled production worker and a new configuration-supplied model ID. The candidate
keeps all 196 q4 decoder matrices and q4 vision, with chunked FP16 embeddings/output head.
With the unchanged app-owned v10 prompt it returns `Workshop Confirmed`, `1,912.15 USD`,
`2026-07-19` through `2026-08-06`, and `kind: "iou"`. Source-field, runtime and explicit
GPU-buffer retirement checks pass; all 5,408 observed buffers are destroyed, queues drain,
and the owned browser/server/child exit without errors or timeout. The maximum observed
individual GPU buffer is 64 MiB; peak logical allocated bytes on the decoder device are
3,090,316,608. These observations do not establish physical VRAM release or phone fit.

The first full run produced the same correct output and clean GPU retirement but is retained
as **failed** because its eager test-cache existence probes opened two unused HTTP bodies
which closed prematurely. A separate v2 test transport defers HTTP reads until response bodies
are consumed. Four transport/composition tests pass; model configuration, prompt, graphs,
generation settings and worker remain unchanged. The fresh v2 run has no transport errors.

Successful result: `F:/Temp/OpenChat-IOU/output/playwright/catalog-qwen-f16-v2-Nbm6D4/result.json`,
SHA-256 `64fe42a877f67b78f6bc703bcad21c86fcd289a9e81ca5a80c4bd074697ae59d`.
Failed first run: `F:/Temp/OpenChat-IOU/output/playwright/catalog-qwen-f16-6ak6kt/result.json`,
SHA-256 `ab5312d0b1285be04c0a89de5066b2d355760750c691f527000fee21878ac179`.
Worker SHA-256 used by this historical diagnostic:
`e2d09f941f5643706622e51f6f7b40db34b336997784bca2f8e0cf1413433d08`.

This is one previously exposed image on desktop hardware, with a test-only read-only local
transport and an FP16 table created in memory from existing files. It is not real CacheStorage,
Model Manager import/download, live app/card, full-corpus or phone qualification. No new model
weights were downloaded or copied to disk, and no production catalog entry, prompt registration,
server or APK was activated. The last complete baseline WebGPU score remains 6/8, the separate
receipt failure remains unresolved, and a new initial app build is required for catalog support.

Earlier, three small hardware-WebGPU checks passed for the new chunked FP16 operations, with exact
native-FP16 oracle agreement and CPU fallback disabled. The initial graph was rejected
because the runtime lacks INT64 Less/GreaterOrEqual kernels. Casting only valid-vocabulary
range predicates to exact FP32 resolves that incompatibility; lookup offsets remain INT64.
The checked cases cover boundary/repeated IDs, empty cached IDs and the real 2048-wide head,
but only a synthetic 33-row table. Full image inference was not covered by those operator-only checks.

A verbose-logging run produced correct outputs but failed the strict error-channel check
on shader-source dumps. A fresh run suppresses only those optional dumps; graph/oracle,
CPU-fallback rejection and actual error detection remain unchanged. All buffers and devices
retire cleanly and the owned browser/server/child exit. Six additional diagnostic unit tests
pass. Full graph construction with the tested predicates also passes exact byte-reversal
checks, preserving all 196 q4 decoder matrices; those operator checks did not run the complete graphs.

GPU result: `F:/Temp/OpenChat-IOU/output/playwright/qwen-head-f16-operators-v3-KaYTSf/result.json`,
SHA-256 `9c9503b4bdae16b52dd0f62c15ea36a445673ffe8a7dfd192369d50f33d4880d`.
Assessment: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-head-f16-webgpu-assessment.result.json`,
SHA-256 `73bb9fc87b0f0bc030e65b26c72d03407b953e92926498189827198cf46a6b36`.
No production change, weight download, full-corpus score change or server/APK update is claimed.

The chunked FP16 embeddings/output-head prototype now passes the selected workshop case in
the actual converted native runtime, including its real vision pass and 196 unchanged q4
decoder matrices. The original shared BF16 table is rounded to FP16 in ten <=64 MiB chunks;
head arithmetic is FP16 with FP32 public interfaces. One unchanged-input/v10-prompt generation
finishes at EOS after 68 tokens. The frozen source and actual offline host/app card-field
gates pass 1/1. This is **not WebGPU or phone acceptance**, and the saved WebGPU score remains
6/8; the separate receipt failure is still unresolved.

The initial attempt was rejected before decoder creation by the existing one-shard admission
guard. A separate diagnostic-only adapter admits exactly the two pinned files; generation
math and production source remain unchanged. Exact wire-level reversal proves that unrelated
graph bytes are preserved, including protobuf fields which a normal serializer repacks.
Eight diagnostic tests cover wire integrity/rejection, chunk coverage, lookup/head operators
and two-shard admission. The successful child exits zero, releases all three sessions and
verifies source/input identity. No new weights are downloaded or copied to disk.

Result: `F:/Temp/OpenChat-IOU/output/qwen-v10-head-f16-native-v2-da2kJv/result.json`,
SHA-256 `1f69f5e8457993d3d9a5ade5218857b573b5a98c418ac45af9c112df1e9cf60d`.
Assessment: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-v10-head-f16-assessment.result.json`,
SHA-256 `f7f44169aef1bde8160dad9e8440b8e00797bf80c189b71d1381ffc7acdacb8a`.
Elapsed 82.4 seconds, peak native-process RSS approximately 8.19 GiB. This diagnostic builds
622,329,856 bytes of FP16 weights in memory, so RSS is not a phone memory estimate. WebGPU
numerics, full-corpus accuracy, phone memory/repeats, live card qualification, activation,
server deployment and an updated local-test APK remain open. The user subsequently authorized
the configurable WebGPU model catalog. Its implementation and format are described in
[the catalog guide](../webgpu-model-catalog.md); this refactor does not activate or qualify the
mixed-precision candidate, and requires a new initial application build before phone use.

The mixed-precision candidate now passes the selected case with current converted vision
features: original embeddings/output head, 196 q4 decoder matrices, and the original decoder
implementation. A single native vision pass reproduces the prior feature hashes exactly;
generation consumes those four tensors once, with no original vision forward. Source and
actual offline card-field gates pass 1/1. Two feature-admission tests and all input/source/
matrix-hash checks pass; both owned children exit cleanly. Only about 4.81 MiB of features
are added, not a new weight checkpoint. This is not a converted-runtime/all-WebGPU fix,
broader accuracy qualification, phone test, activation, deployment or APK update.
Assessment: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-v10-mixed-vision-assessment.result.json`,
SHA-256 `a0fa95386ac415196e69aac16b633cdb0d7b7ad50997587fdd30788684b605b2`.

Weight-only controls now reproduce the failing classification in the original implementation
by substituting the converted q4 text-weight values in memory. Original vision, captured
inputs and generation settings are unchanged; 113 unquantized normalization parameters match.
The tied embedding/output-head payloads match, and three native operator probes validate the
unpacking formula. Q4 embeddings/head alone and q4 decoder layers alone each pass the selected
case; their combination fails. Both partial answers match the original reference exactly.
This identifies a weight-group interaction on one case, not a broken runtime layer or a full
corpus fix. Original embeddings/head with q4 layers are a candidate precision intervention
that still needs converted-vision/runtime, broader accuracy and phone-memory qualification.
Six diagnostic unit tests pass; all three owned children exit cleanly with source/input
identity preserved. No weight checkpoint is copied and no production source/assets are changed.
Assessment: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-v10-text-weight-isolation-assessment.result.json`,
SHA-256 `d6e48d914246168c0f756fbfd3a5b4fc305d86cb017d959beff08f215cc0fc14`.

A subsequent subsystem-isolation test restores all four original FP32 vision outputs at
the converted model's vision boundary, keeping text embeddings, decoder, transport, inputs
and generation settings unchanged. The same classification remains wrong, although JSON
whitespace changes. Both the frozen source oracle and actual offline card-field replay
reject the result. The complete vision-output restoration is insufficient on this case;
the remaining converted text path needs investigation. This does not prove quantization
or a decoder-only implementation defect. Four diagnostic contract tests pass, both owned
children exit cleanly and all native sessions are released. The binary diagnostic output
adds only about 4.81 MiB; no model weights were downloaded or duplicated. No app/host runtime
source, registration, server or APK changed.
Assessment: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-v10-vision-isolation-assessment.result.json`,
SHA-256 `af81ba39facd640a1811e59a33eb96c45da47bc27f97da549f1cc0156e9414bb`.

A matched native CPU reference now reproduces the converted WebGPU classification error
byte-for-byte, using current published graphs, weights, staged facade and captured inputs.
Restoring only the original vision position table in a second native run also reproduces
the same wrong answer. Original FP32 remains correct on that case. This excludes WebGPU
as a necessary cause, but does not isolate wider weight quantization from export/runtime
differences. Neither diagnostic is an app fallback or a production graph change.
The unchanged source and offline card-field gates reject the converted answers; no corpus
score, activation or phone qualification improves. Both owned children exit cleanly, with
all native sessions released and sources/inputs unchanged; no weights were downloaded/copied.
Comparison: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-v10-native-comparison-assessment.result.json`,
SHA-256 `f3b93c5b8fdf70bfc44bed16f9294a72ed39d04104057c432f9b09cd9a9bb47e`.

An additional Qwen raw-contract candidate requests currency first and expresses payment
completion as a boolean rather than an app enum. All eight production-96 WebGPU calls finish,
but the frozen source-fact gate scores **4/8**. It recovers a previously missed printed
currency while introducing an unprinted currency elsewhere and retaining payment-status
errors. Wire-format normalization is possible for all eight; this does not make the facts
correct. Reject the candidate and do not add its prototype adapter to the production app.
The unchanged eight-case expected values, one runtime admission test and two positive/negative
source-contract tests remain separate from model accuracy. No host or app source changed.
Result: `F:/Temp/OpenChat-IOU/output/playwright/qwen-raw-contract-eight-production96-dTHzzW/result.json`,
SHA-256 `00226d536386005df78400f9a7760f3765ec73205babd94991570600d8a87d2e`.
Assessment: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-image-v15.assessment.result.json`,
SHA-256 `a6a6fd265c6b60a4b3d4fc4e1748f0567741dc308f88808de548840ad7ce42b6`.

The best Qwen prompt has now been compared with the cached original FP32 checkpoint on
its two remaining failure cases. Fresh WebGPU answers reproduce both historical outputs;
the reference consumes the exact four tensors captured at `model.generate`, with matching
tokenization and all 46 captured generation controls. Both reference requests complete at
EOS within the unchanged 96-token budget. The first answer is byte-identically wrong in
both paths; the second is correct in original FP32 but incorrectly classified in converted
q4/WebGPU. Frozen source and offline host/partner card-field gates score 0/2 versus 1/2 on
these selected failure cases. The full saved WebGPU score remains six of eight.

This is not one proven common prompt defect: conversion/WebGPU is unnecessary for the
first failure, while combined weight/runtime differences affect the second. Input-detail
versus prompt effects, and quantization versus implementation, are not yet isolated.
No app-specific correction, CPU fallback, production activation, deployment or APK update
was introduced. Both owned browsers/children closed, caches and input tensors were preserved.
Comparison: `F:/Temp/OpenChat-IOU/admin/new-model-prompts-20260910/qwen-v10-matched-reference-assessment.result.json`,
SHA-256 `8a3bd8d543d564cf6d45fced3bb12e23b5fe709ad2c73edebc388fdd6b480fe6`.

The latest Qwen question-style candidate keeps the better four-field contract and order.
Eight fresh WebGPU calls complete, but exact source and current-host/partner card-field
checks both score **3/8**. Headings and dates are correct across all eight; missing currencies,
money-field labels and payment classification still fail. Reject this candidate and keep the
recorded six-of-eight prompt. No source oracle or app grammar was relaxed. The subsequent
cached-original comparison is recorded above; it is not a production CPU fallback.
Raw result: `F:/Temp/OpenChat-IOU/output/playwright/qwen-four-field-candidate-eight-production96-QdnXtN/result.json`,
SHA-256 `bced944f1598ecb201abbc2460bce4c501fe27287a7ab372cb5cfa4e7acb98f8`.

The preceding Qwen-only control moves just one declaration line in its better four-field prompt
(`kind` first). Eight fresh calls complete without GPU errors; exact source and current-host/
partner card-field checks both score **4/8**. Its requested field order passes 8/8, but it
introduces an unprinted date on a date-free image and appends an amount to another heading,
while the prior receipt/classification failures remain. Reject this control too; retain the
recorded six-of-eight candidate. This separates interface/runtime success from the unresolved
model accuracy gate; it is not a reason to add partner-specific corrections to OpenChat.
Raw result: `F:/Temp/OpenChat-IOU/output/playwright/qwen-four-field-order-eight-production96-QBh2OE/result.json`,
SHA-256 `1c166c53e96e2b2d5b7d19eeaad8847f0ffc898edf45d75a603e2ea497e0dee3`.

The latest exact-text control submits the successful five-field Gemma candidate to Qwen
without changing the worker or source oracle. All eight fresh WebGPU calls and retirement/
cache/cleanup checks pass, but source accuracy and current-host/partner card-field replay
both fail **3/8**. Wrong headings, missing currency, a malformed date range and incorrect
completed-payment classification remain. Reject this control; it does not replace Qwen's
better six-of-eight model-specific candidate. The raw result is
`F:/Temp/OpenChat-IOU/output/playwright/qwen-five-field-eight-production96-fe8HqW/result.json`,
SHA-256 `ce45631e42e69980b7aaf620311ff157bc7155325a2947afb9f65d23a658c82f`.
The new current-source assessor and fixed expected app fields were frozen before inference;
historical assessor pins were preserved. No prompts were activated and no server/APK changed.

September 12 superseding checkpoint: a fresh Gemma repeat reproduces all eight captured answers
exactly and passes the predeclared app-compatible field check (eight of eight). Its strict
formatting score remains six of eight. The new generic handoff also passes all eight offline
card-field replays. The historical app-owned Qwen control fails five of its
remaining six images, making three of eight overall; it is rejected. Gemma's next app-owned
prompt correctly transcribes the relevant values on eight exposed images, but two complete
date spans violate the strict formatting contract: six of eight remain strict passes. An
explicit partner-app date-format adapter replays all eight captured answers into correct app
fields without revising that original score. The fresh repeat and subsequent generic replay
are separate checks; they do not jointly claim an integrated live-browser inference run.

All 14 new requests used the unchanged production 96-token WebGPU worker and completed
with source/cache identity and owned cleanup checks passing, as did the subsequent eight-call
repeat. No new prompt, registration, server or APK was activated.
Interpretation and conversion remain in the partner app; host canonical validation is
unchanged. Qwen accuracy, integrated browser/emulator/phone inference, private type/direction,
reconnect and delivery acceptance remain required. No release readiness is claimed by these results.

The following 192-token results are historical, not the latest per-model screen.

The latest compact app-authored per-model prompts completed four original full-image
requests each with the separate 192-token diagnostic worker. Source-fact comparison passes
only 1/4 Qwen images and 0/4 Gemma images. Both still invent currency on the currency-free
input; note/heading selection remains wrong, and Gemma's range dates regressed to empty.
All eight monetary amounts and payment classifications are correct in this batch, which
does not make the complete responses acceptable. The errors are present in raw model output,
before host parsing or partner-card normalization. No failed prompt was activated.

The runner's six offline tests pass independently. These source-screen results are not a new
app/card replay, phone qualification, production output-budget change or APK build. Historical
source-bound assessors remain unchanged. Current receipts:

- `output/playwright/candidate-image-192-qwen-SQ3yxs/result.json`, SHA-256
  `9d4cb34124a2ab643699f25d9cea4be7fe08d67a7ea9f1a63c32149a83e934cc`.
- `output/playwright/candidate-image-192-gemma-IyvP05/result.json`, SHA-256
  `46525e2ae4becbdb809f48b216d78ba1ec4e6bd0d505d63efdda59d6bb27b267`.

A subsequent one-case Qwen diagnostic captured the actual generation tensors and reproduced
the earlier v7 raw answer byte-for-byte. The original FP32 checkpoint, replaying those same
tensors, token IDs and generation controls, also selected wrong source fields. This rules
out WebGPU/quantization as a necessary cause of that failure, not shared preprocessing or
model limitations. It is not numerical-equivalence, app-card or phone qualification. The
capture/reference helpers pass 9/18 offline tests respectively; both real requests completed
with source hashes unchanged and owned processes closed. No production fallback was added.
Receipts: `output/playwright/qwen-arabic-v7-input-capture-zlWy9p/result.json`, SHA-256
`1e7df87dd0d4733360544a90636e4be6fee997a869e2610aaa16b5fc71fa8d70`; and
`output/qwen-original-captured-v7-65ez0vbx/result.json`, SHA-256
`19508982afa97bdd3dffec3d18936c70bf9ecd94b9576f786672952094c19c58`.

## Earlier shared-prompt accuracy gate

The subsequent two-model, four-image prompt-order comparison **failed acceptance**. Using the
same unchanged worker and 96-token limit, Qwen completed four requests before an Arabic
request hit the output-token-limit guard; three planned cases were not run. Gemma completed
all eight requests. This was not a device-loss crash: all 72,874 observed buffers across the
thirteen attempts were explicitly freed, including the failed request, and both complete
consoles contained no native/GPU errors. Cache bodies were reverified before/after; no model
download or model-cache mutation occurred. Both owned browsers/proxies closed.

Moving one app-supplied output instruction to the end did not solve accuracy. Completed
source-and-card checks passed 1/2 versus 0/2 for the two Qwen subsets, and 1/4 versus 1/4 for
Gemma. Those are completed-subset counts, not a complete Qwen screen or a shared-prompt pass.
The candidate also changed a correct month to an incorrect month in Gemma's interval output.
Current host/app replay preserves the failures and the assessment CLI exits 1. The test
runners and acceptance adapter pass 29 focused offline tests; those verify failure detection,
not model accuracy. No production prompt, source model settings, server or APK changed.

Latest evidence: `output/playwright/shared-note-order-assessment-20260910-HGSPmK/result.json`,
SHA-256 `47e2f91e8d746920bd4dc4bc8358378c8f84cc405f3137074262369fd633f2b3`.
It binds the complete Gemma and interrupted Qwen receipts and explicitly rejects incomplete
two-model qualification. Physical-phone and broader shared-prompt gates remain open.

Earlier same-worker runtime milestone: the **unchanged assembled production worker** completed the fixed
Arabic → reservation → Arabic same-worker desktop smoke sequence, with no model-artifact HTTP
requests during inference. All 17,926 observed GPU buffers were explicitly destroyed before
their devices; six hardware devices retired with one real and one recorded idempotent destroy
call each. The two Arabic raw outputs are byte-identical and retain 12,900 EGP / 14 Aug 2026;
the reservation output retains 1,912.15 USD and Jul 19–Aug 6. This uses the current six-field
app prompt, not the prospective seven-field common prompt. See the full receipt below.
Shared-prompt, app-card and physical-phone acceptance are still incomplete; no deployed
server or APK was updated by this smoke test.

Earlier paired accuracy diagnostic: an eight-request Qwen comparison retained the strongest shared
prompt while replacing only its currency instruction line with a contrastive example. Baseline
and variant both score 2/4 against the unchanged source/card oracle; absent currency is still
invented. The variant was rejected before broader or second-model advancement. The partner app
prepared optional evidence transport/validation and private matching in its own source only;
no host interface schema, active image prompt, deployment or APK changed. Subsequent generic
completion and duplicate-field guards are prepared in source. At that earlier checkpoint,
diagnostics totalled **206 desktop WebGPU requests (61 Gemma, 145 Qwen), in 27 completed
batches plus one aborted memo-only batch**,
including one deliberate token-limit negative case, and eleven CPU references. The following
phase records preserve their historical counts and expectations.

The partner's focused checks pass 330 tests and both TypeScript checks. They cover separated
row-local evidence, ambiguity rejection, no direct-import behavior expansion, and omission of
intermediate evidence from confirmation. These are constructed boundary tests, not fresh-model
accuracy acceptance. Original array cardinality is not carried through normalization, so no
single-survivor caption overwrite was adopted. Offline token checks establish only that compact
expected outputs fit the existing cap, not that the models will produce those values or format.
No app-specific schemas or logic were added to OpenChat. The preceding seven-field screen's runtime receipt is
`output/playwright/qwen-production-full-model-20260909-JLJk6z/result.json`, SHA-256
`31c51f4a9e22c5717fe1d2ea37492412ccc494656e4285cfe6f51edbac0a83ee`. Runtime/source checks passed,
browser/server closed, and the disposable profile was removed while retaining the receipt and
model caches. The shared-prompt and physical-phone release gates remain incomplete.
An offline replay through the actual current host and partner card code confirms only 1/4
source-and-card matches (0/4 strict serialization). The separately tested accuracy assessor now
saves its report and exits nonzero on a failed content screen; the root invocation did so. A
successful runtime or evaluation process is not a passing release gate.

That earlier paired comparison retains the source symbol policy and omission rules. Its example
variant still invents a currency for the currency-free input; the two original images retain
correct source fields. The other transfer's visible memo still violates the diagnostic heading
instruction, but is not invented text. Both prompts pass 2/4 current source/card checks and
0/4 strict JSON-shape checks; code fences alone are not reported as wrong end-user values.
Root reran five adapter tests and thirteen offline assessor tests. The assessor binds the
current host through two documented in-memory substitutions in a frozen helper (host hash and
the mock's valid success discriminator); historical source and oracles are not edited.
The independent actual assessment returns nonzero and matches the retained report byte-for-byte.
Result `output/playwright/qwen-production-full-model-20260909-qJ2sfh/result.json`, SHA-256
`b43abe2c32df1caf3acc49493764ce831237f5b84a63745fffffd5f526b09518`;
assessment `admin/proof-currency-example-assessment-qwen-qj2sfh.json`, SHA-256
`7c5e3b49ac2ba0758c51e146c44764ff251ebcbc8bfdce05a8854c2cb7bdde78`.
All eight requests completed on hardware WebGPU with unchanged source/image/generation
settings and no GPU failures. Worker retirement and browser/server closure verified. Only
the disposable profile was removed (1,868,110,718 logical bytes); models and evidence remain.
No second-model, broader-corpus, phone, registration, server or APK advancement followed.

A separate admin-only vision-attention feasibility builder now passes 14 offline tests.
Four fixed head groups preserve the full sequence, mask and head order; at the unchanged
640-patch bound, individual FP32 score tensors shrink from 26,214,400 bytes to 6,553,600
bytes per group. This is not measured total GPU memory: scheduling, retained branches and
allocator reuse may remove the benefit. The tests execute tiny serialized graphs through
an offline semantic control, not browser JSPI or a model. Builder SHA-256
`65b34a894b24415f46f80a8af7d7673b2a9615bdf8c6b054294f91b43eef07dc`;
test SHA-256 `9767cdfb2ccd92b1e39982d909100703cb5e8a9c8a532b276e4d9c1ffa297a83`.
The subsequent standalone pinned-JSPI test passes on desktop NVIDIA Ampere: all 655,360 output
values are byte-identical across baseline/grouped graphs and cold/warm calls with both masks.
Native placement logs put all 5 baseline / 33 grouped nodes on WebGPU; CPU fallback is disabled
and actual device-owned dispatch/submission is observed. An independent sparse FP64 control
passes with maximum absolute error below 8.54e-8. Root reconstructed the buffer ledgers and
verified all retained binary outputs. Exposed undestroyed GPUBuffer peak drops from 73,925,024
to 43,517,600 bytes (about 41.1%); this is not physical VRAM or full-model/phone memory.
The first eight-call batch remains failed because its bounded console capture overflowed.
Only that limit changed from 2,000 to 4,096 for the passing eight-call repeat; all 2,568 log lines
were then retained. These 16 synthetic attention calls do not increase the full-model count.
Passing result `output/playwright/qwen-head-groups-synthetic-20260910-qw6JJf/result.json`, SHA-256
`7c2f84a20a2960c43bf0a17b3c9e344a4b6cacf411b5635fa60e00fe12c514eb`;
failed receipt SHA-256 `181c899f614f83f58c6afc9fbfdbfaab757b37e2c65eaf7c1d501d728fce58e5`.
The combined offline graph/reference/runner checks pass 34 tests. Both browser/server instances
closed, all workers/devices retired, and only their disposable profiles were removed (28,598,926
logical bytes). Original models and evidence remain. No production graph, image budget or APK
changed. Full vision-graph equivalence must precede any budget experiment; absent evidence,
image accuracy and physical-phone acceptance remain separate, incomplete gates.

The subsequent complete delivered-vision comparison preserves the production DeepStack patch,
all four outputs and all learned weights; captured inputs remain at 640/640/616 patches.
Root passes 37 offline graph/input/final-runner tests. Two actual desktop baseline initialization
attempts both failed before inference because strict CPU fallback prohibition rejected native
assignments. The grouped full graph never ran. No additional model or encoder calls completed,
and the synthetic attention result above remains separate from full-encoder acceptance.
Logs show 64 distinct registry-missing nodes and 25 additional CPU-preferred nodes, including
position interpolation and attention-mask calculations—not merely tensor-shape bookkeeping.
These are capability/optimization messages, not a complete final placement inventory.

The first native configuration reported integer support disabled. A diagnostic-only retry
requested `ep.webgpuexecutionprovider.enableInt64=1` while retaining strict CPU rejection.
The native provider still reported `0`, although the later session-settings trace contained
`1`. Installed `lib/wasm/session-options.ts:260` creates the providers before applying generic
`extra` entries at lines 290–293. That configuration route is too late; enabled-kernel coverage
has not been tested. The key exists in the pinned WASM and in the
[upstream provider options](https://raw.githubusercontent.com/microsoft/onnxruntime/main/onnxruntime/core/providers/webgpu/webgpu_provider_options.h).
An isolated before-provider configuration check is the next step, without allowing CPU model
math. No production library, graph, image budget, server or APK was changed. Device destruction
followed failed initialization in these diagnostics; it does not establish the historical
phone-crash cause.

Both existing weight shards verified completely, including streamed BF16-to-FP32 companion
conversion and its terminal digest checks. Each run retains all 400 console records and
unchanged source/asset identities. The runner now rejects late native errors after browser
closure as well as per-case errors; old failed evidence and source bytes were retained.
First result `output/playwright/qwen-full-vision-20260910-AgfUEd/result.json`, SHA-256
`19db0063650f016d84c3f1d8cb52085d653a6d9728f357060e5227e00ae5094c`;
retry `output/playwright/qwen-full-vision-20260910-zil2Xo/result.json`, SHA-256
`6ce60a84613555c287c1af22490e1571fab870a60462d2c61c287c96f737dd98`.
Both processes exited 1 and closed their workers/devices/browser/server. Only their disposable
profiles were removed: 20,588,681 logical bytes (20,885,504 observed free bytes reclaimed).
Model downloads, original images and diagnostic evidence remain. Release gates stay incomplete.

A third initialization attempt used one reversible in-memory JavaScript-bridge edit to forward
the requested integer option before provider creation. Native WASM and installed library files
remain untouched, and strict CPU rejection stays enabled. Native logs now confirm integer
support enabled; registry-missing nodes drop 64 to 46 and CPU-preferred messages 25 to one.
However, strict baseline creation still fails on remaining indexing/arithmetic/reduction
operations and two FP32 positional clamps. This is a verified configuration-order correction
in the diagnostic, not complete encoder or phone compatibility. No inference/output/comparison
or GPU dispatch occurred in any of the three attempts; the grouped full graph never ran.
The final offline graph/input/runner total is 38 passing tests, including bridge ordering,
byte-exact restoration, syntax and late-native-error checks.

Third result `output/playwright/qwen-full-vision-20260910-o8zKOQ/result.json`, SHA-256
`78d5664b0ab60c6718ba848f63a536dc5a6e0554197625e97b1d67f67a914e05`;
plan `0ce083da09d2a35f0817aadf536d841ccb3435155c7b9f6764dd6eeb4c03d133`;
diagnostic derived bridge SHA-256
`e354ad9515487907fb75416a0c264759405be7d81bec33b1c0bd0b4f105e6aeb`.
Independent review verified the unique edit, 73 source/input/reference hashes, complete
343-record console and failure cleanup. Its disposable profile was removed (10,299,984 logical
bytes; 10,448,896 observed free bytes reclaimed). Across all three profiles, 30,888,665 logical
bytes were removed; retained model downloads and evidence were not deleted. No production
runtime, server or APK changed. Any future shape/grid specialization needs an explicitly
constrained folding boundary so learned model calculations are not silently moved to the CPU.

That boundary is now implemented in an admin-only geometry compiler: exactly 91 nodes
depending solely on the full single-image grid and pixel dimensions become 13 constants.
Pixel values and external weights are not read. Every remaining node/initializer byte and
all four outputs are preserved. Runtime optimization must be disabled to retain learned
positional calculations on GPU, and strict CPU rejection remains required. This is not a
production graph change or a new image-budget allowance.

The user-approved isolated native reference ran outside the command sandbox and exited 0
in about 4.7 seconds. An independently extracted original-ONNX slice (91 nodes, 16 inline
constants, no learned weights) ran sequentially on CPU ORT 1.24.3 with optimization disabled.
All 55 existing grids and 715 complete boundary tensors matched the compiler elementwise
and byte-for-byte at zero tolerance. All 55 sessions released, zero stayed active, and sources
remained unchanged. Root also passed 41 focused offline graph/compiler/reference tests.
This CPU reference is diagnostic only, not a deployed learned-model fallback.

Result `output/qwen-vision-geometry-reference-20260910-gswhG9/result.json`, SHA-256
`0e1696d26a286a768cf6f12989a260ac4f8c471f1ae67f116a4c89abd17a5b12`;
plan `9ec5895ea008a7445d186b394a5fa3e6a8d515b2ac25fe20b17f86c3aa29e270`;
compiler `423f8e9b120c4f538d5e0537f853f35f0a08a84177419219302eb6efdf62453f`;
independent reference helper `b30e9fd7f046ed13382a59ef4cae559a32196ebc1c84457b5644f282475d4300`.
Only 3,246,896 bytes of reference tensors were retained; no browser profile or model download
was created. These 55 geometry-only CPU calls do not increment model-generation or full-encoder
inference counts. The next GPU check must bind this reference and fresh per-grid constants;
complete-encoder execution/equivalence, memory savings, shared-prompt accuracy and phone
acceptance remain unverified. Server and APK are unchanged.

The source-bound reference admission and runtime-retention checks now pass another 21 focused
tests (62 current graph/compiler/reference/admission/input/runner tests total). Actual inserted
constants match verified full-grid fingerprints. Native per-case and final ordered node-count
checks reject missing, extra or late placement records, contradictory optimization/CPU settings,
and ConstantFolding. The next default-sandbox desktop attempt completed two real full-vision
calls on the retained 640-patch input, about 1,256 ms cold / 189 ms warm including readback.
All four full FP32 output pairs are finite and byte-identical; both input post-run hashes,
weight bodies and companion EOF guards verified independently.

The batch correctly remains **failed**: native WebGPU placement reports 1,146 nodes versus
1,098 serialized baseline nodes. The grouped graph and later cases never ran. Native integer
support is enabled, graph optimization disabled, strict CPU rejection active, with no CPU
assignments, native E/F or ConstantFolding logs. Runtime graph transformations are under
investigation; the count increase is not waived. The harness stopped before its comparison
stage; cold/warm equality comes from independent full-file checks of the retained outputs.

Result `output/playwright/qwen-full-vision-20260910-7Inqqe/result.json`, SHA-256
`13a5927b85b8a9040cc3e74e48f487701f1250bb85c3647208df093c13900ff8`;
plan `629f5e3ca0ff0334b511f8475fca7259cacac43d729c41465797672785780dba`.
All 74 source/input/reference bindings and 3,464 complete console records verified. The logical
GPUBuffer peak is 687,400,144 bytes, not physical VRAM or measured grouped savings. All 1,133
created buffers were destroyed, zero balance before device retirement, and all worker/browser/
server resources closed. The owned disposable profile was removed (15,725,510 logical bytes);
eight outputs, failed receipt, exact diagnostic source archives and models remain. These are
two encoder GPU calls, not additional model-generation requests or phone qualification.
No production code, prompt, server or APK changed; release acceptance remains incomplete.

The follow-up explicitly selected the supported WebGPU `preferredLayout: "NCHW"` option,
without changing input/graph/weight bytes, limits, tolerance or exact node counts. All11 focused
runner tests pass. The complete desktop baseline/grouped comparison then **passed12/12 calls**
across three retained images, with native layout0 and exact1098/1770 nodes in every pair.
CPU rejection, disabled optimization and integer support were confirmed natively. All48
full-tensor comparisons are error0, independently rechecked; all8 Arabic tensors also remain
byte-identical to the earlier layout1 run. This isolates the extra nodes to the provider layout
path; it does not enumerate the previous transformation's individual nodes or waive the gate.

Passing result `output/playwright/qwen-full-vision-20260910-RFUDPt/result.json`, SHA-256
`e9d68265138acbcfd426df30156d52a903aaaf42c1b251b80c80b54fa50df15c`;
plan `588a2d877b45d45d08f40dd05cdfc24bab56139763b2246e114f887158c168b9`;
runner `10fa091b935d53085a16b2eee0b9eef6ddc171521fc92b5bf119f62cc83ca1f1`;
worker `18b251434851164096b6a26981a55add5495b225f24d4e49ad7e0c371c23b535`.
All74 bindings,48 output files,12 complete weight transfers, post-call input hashes and24,519
complete console records verified. All6,837 buffers were destroyed, zero balance before
retirement, and every session/worker/device/browser/server closed. The process exited0; its
disposable201-file profile was removed (27,625,553 logical bytes), with evidence/models retained.

Grouping saves29,358,896 logical GPUBuffer bytes (28MiB, about4.25%), not physical VRAM;
warm Arabic execution became about22% slower. The isolated encoder omits staged embedding,
decoder and Android driver memory. Keep this diagnostic-only: neither higher-resolution phone
headroom nor a useful image-extraction improvement is proved. A direct full-model comparison
at640 versus748 English-image patches with the identical app-owned prompt is the next relevant
hypothesis test;748 is not a proposed phone limit. Prior improved high-resolution CPU reading
required4000 patches and exceeded the current decoder context, and absent-currency invention
persisted. There are now14 complete-encoder GPU calls, not additional model-generation requests.
Shared-prompt, complete-model and physical-phone acceptance remain unmet; no deployment or
APK update occurred.

The one additional748-patch geometry reference passed after explicit approval to run that
isolated native check outside the command sandbox:13 exact outputs/2,292,008 bytes, one
session created/released,15 tensors disposed,38 source bindings unchanged. Result
`output/qwen-vision-geometry-reference-748-20260910-iHjktL/result.json` has SHA-256
`e5efd93714ed48bfccf5ba0ff45b570b0f2577eeb209747195f37a060fdfd3f1`.
This qualifies only grid/shape calculations for the two-resolution diagnostic, not learned
model execution, larger phone inputs or extraction accuracy. No production changes followed.

The subsequent full-worker640/748 diagnostic failed at decoder admission, before generation.
The640 control reproduced the four original input hashes (604tokens); all1770 vision nodes
and the one embedding node were placed on WebGPU, but the2464-node decoder requested CPU
fallback and was correctly rejected. The748 request never ran. This is one failed full-model
attempt, not a successful extraction or resolution comparison. Complete console inspection
identified485 unsupported INT64 shape/index nodes and one UINT8 weight reshape. Shape-control
preparation and a byte-identical weight alias require independent verification; learned CPU
fallback remains prohibited. No production/runtime graph change is approved by this result.

Result `output/playwright/qwen-budget-full-model-20260910-BibIMW/result.json` has SHA-256
`3e62e745014ad0a3eca761e17f2390f3a5de8be3cf71beca62db76ae642cdf47`; all135 source bindings
and2352 complete console records verified. Global logger filtering left native effective
INT64/layout confirmation unproven. Repeated error callbacks also obscured the disposal ACK
in the harness; actual telemetry shows `terminal:disposed`,1151 buffers explicitly destroyed,
zero outstanding, both devices retired and worker/browser/server closed. Neither evidence
issue excuses the decoder failure. Its disposable212-file profile was removed, reclaiming
1,852,592,128 observed free bytes; exact source archives/evidence/model downloads remain.
Shared-prompt, full-model and phone acceptance remain incomplete. Server/APK are unchanged.
Both diagnostic-only evidence fixes subsequently passed24 offline checks, including an
archived-original/revised ACK regression and supported native-logger setter test. The worker
typecheck adds no diagnostics relative to production. No new runtime test followed; the old
failed receipt remains unchanged. Before a broad decoder rewrite, test one bounded dynamic
INT32 control island against its INT64 oracle on the actual strict native backend: dtype
conversion alone may not overcome the58 recorded CPU-preference assignments.

The smaller INT32 control-island probe subsequently falsified a simple dtype fix. Its original
13-node CPU graph matched the independent oracle in all four prompt/decode boundary cases
(16 outputs,6,144,688 bytes). The16-node strict GPU candidate failed before inference because
the native runtime preferred CPU for10 metadata operations; no missing-kernel messages or GPU
allocations occurred. Native effective INT64/NCHW/opt0/strictCPU settings are now confirmed.
This is a placement-policy barrier in the synthetic island, not a model accuracy or phone test.
Result `output/playwright/qwen-decoder-control-20260910-QJK8v0/result.json`, SHA-256
`076864ea6c31923c278e35d938aaa1aba0cb8c7a5532b8b9cf04f4050421a019`;20 offline checks passed,
all original CPU output files/source bindings verified, complete49-record console retained.
Runtime cleanup completed; only its165-file disposable profile was removed. Do not broaden
the failed conversion or relax CPU fallback. The subsequent four-node probe below tests
explicit host-computed, dimension-validated INT64 control inputs. No production/server/APK
update occurred, and release acceptance remains incomplete.

The explicit host-control probe then passed outside the command sandbox as approved:
`output/playwright/qwen-decoder-host-20260910-1TcdBz/result.json`, SHA-256
`bb28bde4aa979e1b4d0f0071795c22fea628ac8d04756e8044ddb3daece3b9e8`.
Sixteen offline tests preceded four original CPU reference calls and four strict native GPU
calls. All16 outputs per backend (6,144,688 bytes) match the independent oracle exactly.
Native logs place all4 unchanged FP32 nodes on WebGPU with CPU fallback disabled, INT64
enabled, NCHW layout and optimization disabled; no CPU assignments or native errors occur.
All24 GPU input pre/post hashes agree. All37 buffers were explicitly destroyed before
device destruction, and sessions/worker/browser/server closed. The complete314-record
console and source bindings are retained; only the disposable15.2MB profile was removed.
This qualifies the synthetic four-node boundary, not the full decoder, shared-prompt image
accuracy or phone reliability. The host prepares104 bytes of dimension metadata per call;
there is no learned CPU fallback or app-specific logic. Dynamic full-decoder integration
and acceptance remain outstanding. The changed graph, not the sandbox distinction, is the
tested hypothesis; no deployment or APK update is implied.

The subsequent full-decoder metadata reference also passed: five original CPU graph calls,
198 boundary outputs each,990 exact INT64 comparisons/581,152 bytes. Independent verification
confirmed every output, source plan and cleanup:1 session released and1,565 tensor disposals.
Receipt `output/qwen-decoder-metadata-reference-20260910-JSixTB/result.json`, SHA-256
`85e0b7d73ef861690e18ff6e72ad2664ff45389d9bea38852e1ab82382755f86`.
This checks713 original shape-only nodes against eight shared host inputs derived from actual
raw decoder dimensions, including cached and mixed nonfixture lengths. Learned tensor values,
actual position values and masks are not computed or replaced on CPU. The diagnostic graph
also removes five proven dead nodes. Full-model native GPU execution, extraction accuracy,
phone repetition and release acceptance remain separate outstanding gates; no deployment or
APK update occurred at this reference gate.

The first composed full-model diagnostic then loaded all three sessions with native WebGPU
placement (1,770 vision / 1 embedding / 1,745 decoder nodes) and completed 58 decoder calls.
Its 464 host controls and cache continuity checks passed. However, the diagnostic handler
misclassified multiline VERBOSE shader-source dumps as errors, then overflowed its 16 MiB
console bound. No answer was retained; the second image size was not run. The retained
prefix has no native E/F or GPU-failure event, but incomplete capture is not runtime acceptance.
Receipt `output/playwright/qwen-full-host-model-20260910-S2sJ00/result.json`, SHA-256
`8e7d649f3bd58e4be87d315476223adc9eb3f512d9c3a3f3927f146f707cb51a`, remains failed.
Independent review confirmed exact source/input identities, actual disposal acknowledgement,
all 5,497 exposed buffers explicitly destroyed before both devices, and browser/server closure.
Only the regenerable isolated profile was removed (1,854,925,035 logical bytes); evidence,
models and account profiles remain. Correcting diagnostic log framing must not hide actual
errors or relabel this run as passed. No production code, prompt, server or APK changed.

The corrected diagnostic subsequently passed both full-model desktop runs. Exact native
shader blocks now match actual `createShaderModule` source witnesses; nineteen focused tests
pass, and the worker/model/prompt are unchanged. Receipt
`output/playwright/qwen-full-host-logging-model-20260910-iNS7D6/result.json`, SHA-256
`e108f1c6e72ab2e9931af97131fc9006d3ddfdc7e9d79e4a8dfd04afa2892bb3`, records strict native
WebGPU placement for all three sessions in both cases, complete 70,493,114-byte logging,
140 exact shader witnesses, 122 decoder calls and full explicit retirement of 11,270 buffers.
Independent review verified the source plan, cached bodies, controls and complete console.
Accuracy did not improve: both image sizes produce identical fields, with the visible memo
instead of the diagnostic heading and no printed time. Actual partner-card replay preserves
the correct amount, currency and calendar date; its remaining frozen-oracle mismatch is the
note. This is not an invented memo or a missing-card-date failure. The higher budget is not
adopted. Exposed decoder-buffer peaks are 3.779/3.795 GB under diagnostic optimization-disabled
settings, not a phone-memory measurement. The next investigation is the large decoder
allocation and its applicability to production settings. The isolated browser cache was
removed (1,858,798,230 logical bytes); models, accounts and evidence remain. Production,
server, APK, shared-prompt variety and phone acceptance are unchanged/not newly qualified.

Read-only follow-up locates a generic memory target: Qwen's LM head projects all prefill
tokens to vocabulary logits, while generation keeps only the last token after forward.
The observed native dispatch dimensions corroborate the large full-sequence buffer; the
ledger does not directly associate a buffer with a tensor. A last-position operation before
the head may reduce this private generation path's output allocation, while preserving
all KV outputs. It must not redefine general forward/scoring semantics, and changing the
MatMul kernel requires numerical and greedy-output verification. Production defaults to
native optimization `all`, so the diagnostic's optimization-disabled memory peak is not a
production/phone measurement. No candidate has been adopted at this investigation gate.

The isolated last-position-head check now has an independent three-case CPU reference and
three passing original-head WebGPU comparisons. Its diagnostic-only cleanup was corrected
to acknowledge ORT's release-owned device destruction, with all buffers verified destroyed
before the actual call. The reduced-output candidate remains **unverified**: in the latest
run its local weight transfer failed before any GPU session creation or inference. Receipt
`output/playwright/qwen-last-logits-20260910-Qdi9o1/result.json` has SHA-256
`3529c82fb2c766180ca74e1ae344fda0bac885ae777b0b7cf6b772c3c391350a` and remains failed.
Both temporary profiles were cleaned; no production code, server, prompt or APK was updated.
This is not a release-accuracy or phone-readiness pass.

The next isolated run passed all six GPU calls and nine numerical comparisons, with identical
greedy tokens and exact S1 GPU bytes. Receipt `output/playwright/qwen-last-logits-20260910-UQEPqK/result.json`
has SHA-256 `bfe237ba14211aba27c6f680480d514d25b55d8cce6d67c9518d4f202d4c59cf`.
Independent review confirmed strict `[1,2]` native placement, complete shader/console evidence
and all buffers destroyed before each actual device release. Whole-session isolated-head
logical allocation peak dropped from 975.8 MB to 311.2 MB (68.1%); 214.0 MB is the smaller
inference-only peak, not whole-session or physical memory. Only the diagnostic weight-transfer
deadline/reporting changed, with all numerical and native limits preserved. The full-model
candidate was subsequently tested as documented below, but has not been adopted. Phone and
common-prompt release gates remain unmet. The temporary profile was removed.

The full-model last-logits diagnostic now passes runtime and exact baseline raw-output/input
equivalence at both 640/748 patch budgets on the original English 13,500 EGP image. Receipt
`output/playwright/qwen-full-last-logits-model-20260910-gbWQPT/result.json`, SHA-256
`e503e2a8ee3223d27f324cab7d5c25614abc3693291a33c3620474d1d47438f6`, preserves the independent
raw-field failures. Root ran 32 focused offline tests; the model run exited 0 in the default
command sandbox. Native placement `[1770,1,1746]`, strict CPU rejection and complete shader,
console, cache/host-control and buffer-retirement gates passed. Decoder logical peaks fell
from 3.779 / 3.795 GB to 3.385 GB (10.41% / 10.80%), not the isolated-head 68.1% reduction.
The result is diagnostic-only, not physical VRAM or phone memory. Exact generated answers
still omit time, select the visible memo instead of the diagnostic heading and use JSON fences.
No accuracy failure was reclassified as a pass. Production lacks the diagnostic host-input
adapter and other graph/session prerequisites; the candidate graph cannot simply replace its
current decoder. Production, server and APK remain unchanged. The 1,858,798,210-byte temporary
profile was removed after closure; original model cache and result evidence remain.

### Qwen production-source port: preparation record (superseded by integration below)

The proven diagnostic composition now has six reusable source modules beside the existing
WebGPU build helpers: generation graph/runtime, vision graph/geometry/session, and the ORT
early-INT64 configuration patch. They are not yet imported by production entrypoints or
advertised by the download manifest. The server and APK still use the previous implementation.

Root ran all six new focused specs: **170/170 pass**. A strict TypeScript check of those specs
and their imported modules reports zero diagnostics after explicitly typing a recorded-fixture
case array. The geometry helper matches all **715 native boundary hashes across 55 grids**;
the decoder controls match all **990 retained native outputs**. These are deterministic
control-tensor checks, not new model-accuracy or phone-inference results. The vision graph is
576,592 bytes, SHA-256 `b62a78861a16cb0023156cc20dc6d8d7f0d97c99ce2360a9b4670d2f9327f6ac`;
its 1770 nodes preserve all four complete image/DeepStack outputs and unchanged learned weights.
The existing 640-patch/1024-context/96-output-call limits remain intact.

Owned control tensors drain before session retirement. Integration must also drain the outer
staged decoder operation, which surrounds loading and private-feed cleanup; the current outer
release path does not provide that barrier. The frozen vision facade needs a mutable outer
wrapper because existing stage instrumentation replaces `run` and `release`. Both dev and
packaged graph delivery, manifest pins, model-worker-only ORT configuration and transitive
helper rebuild invalidation must change together. Keep the existing cache keys and reuse
verified unchanged weights; do not trigger model downloads during image inference.

The seven existing scoped build/session/delivery/cache/Gemma/audio specs pass **107/107**.
CI discovery already selects the new specs, but a change to only their geometry-reference
fixture initially missed the model workflow. A failing-first coverage check identified that
gap; the workflow now includes that exact fixture path. Both scoped workflow/integration
coverage suites pass **40/40** without running dependency audits or unrelated core tests.

The dynamic vision graph and actual session facade now pass the strict GPU comparison below.
Enablement still requires integration and qualification of the assembled worker, common
app-owned prompt, repeated phone proposals and model-switch/cache behavior. No partner-specific
fields, image labels or normalization belong in these OpenChat helpers.

### Qwen production-source integration: build-stage record (smoke result below)

The feature-gated production source now consumes all six qualified helpers. Development and
packaged delivery compose exactly the same decoder (4,896,612 bytes, SHA-256
`475d9ad51b0da52e7510a8b597bdf42a533e552de3a3b74c58284ae6b2472375`) and vision (576,592 bytes,
SHA-256 `b62a78861a16cb0023156cc20dc6d8d7f0d97c99ce2360a9b4670d2f9327f6ac`) graphs and advertise
those exact manifest hashes. The checked-in source graphs, learned weights, cache keys,
model revisions and optional Gemma audio are unchanged. Only model-worker builds install the
early-INT64 ORT patch. Qwen sessions require NCHW, optimization disabled and CPU fallback
disabled; Gemma's options remain unchanged.

The real staged source now embeds the actual generation/geometry/vision factories. The public
decoder retains 59 inputs while its raw graph receives 71; public vision retains two while its
raw graph receives 15. Native decoder outputs are checked as last-position logits plus all
56 cache outputs. Mutable outer facades preserve worker instrumentation. Terminal release
waits for in-flight loading, inference and all owned-input cleanup before releasing sessions;
concurrent callers share the same retirement promise. Review also found and fixed orphaned
sessions after throwing post-create callbacks and partial DeepStack cleanup after throwing
tensor disposal. Three regression cases cover those failures; only the latter was separately
reproduced before the fix, so these are not all recorded failing-first tests.

Root reran **296/296** tests across 13 scoped model suites and **61/61** model-notice,
distribution and CI-integration checks. Strict TypeScript on those 13 specs plus the actual
Vite config reports zero diagnostics. These are mock/native-interface and packaging checks,
not new learned inference. The real Vite config-loader fixture confirms static transitive
helper freshness, source-relative resolution and recovery after an invalid helper edit.

A model-only build evaluated the actual production build configuration with only its output
destination redirected and the three unrelated workers skipped. The minified worker is
962,323 bytes, SHA-256 `dd107de1bc3fc1c91e7ac16165681f51941f8b9503991c443c1cd749394154ed`.
Receipt `output/integrated-model-worker-hAjaUB/result.json` under the project temp root has
SHA-256 `6846faa2df62e87961afd00be65716449000f3f398f7edd9e9905894b9a0b442` and records unchanged
source identities. This successful build does not establish GPU execution or extraction
accuracy. The earlier component numerical receipts remain immutable and separate.

No server, installed APK, app-authored prompt, Git branch or release publication changed.
Next gates remain assembled-worker GPU inference, common-prompt evaluation on both models,
and repeated phone proposals/model switches. Do not describe the phone or release as ready.

### Assembled production worker: three-request desktop smoke passed

Root executed the unchanged 962,323-byte worker `dd107de1bc3fc1c91e7ac16165681f51941f8b9503991c443c1cd749394154ed`
through a fresh, local-only browser profile. The fixed sequence was Arabic (640 predicted raw
patches), reservation (616), Arabic repeat (640), on one worker with the actual current IOU
six-field prompt (`a921746fc62f9e7fe3d8bc4d89f766f92fa57530e832832b0fdd5b97454fcb82`) and unchanged
96-token allowance. These patch counts are predictions from the actual production layout
helper, not claimed observed processor tensors. No OCR, crop, retry, prompt variant, worker
rewrite or model download was used.

Receipt `output/playwright/qwen-integrated-worker-smoke-20260910-VxDwCq/result.json` is 153,006
bytes, SHA-256 `06e2cf378e386ed1b1568db68c4471fb6832a82836ac029b8194dc9fb844d9c4`.
Plan `4f06bb3bdaad7bcbd2390b334f87bd76a03e6cb27945af88a3a97b7316659acb` completed with exit 0
in 77 seconds including browser/cache setup. Individual requests took 15.334 / 11.501 / 11.647
seconds. All 14 browser cache bodies (1,836,691,582 bytes) matched their exact current manifest
hashes; inference and teardown made zero model-artifact HTTP requests. Original learned weights
and the locally streamed BF16 companion source remain unchanged.

All three requests produced a result and the actual final disposal acknowledgement arrived.
Six NVIDIA Ampere devices performed real submissions/dispatches, with no uncaptured error or
unexpected loss. All 17,926 observed GPU buffers were explicitly destroyed, with zero remaining
before each first device destruction. The production retirement wrapper's second destroy call
was recorded separately as idempotent, not counted as a second device. Decoder logical-buffer
peak is 3,385,260,128 bytes on all three requests; largest buffer is 155,582,464 bytes. This is
not physical VRAM usage or a phone-memory measurement. Native per-node placement counts are
not exposed by the unchanged production worker and were not asserted.

Root and an independent reviewer revalidated the complete 396,594-byte / 1,280-record console,
SHA-256 `096330acf4cb950afef1f5880e764a4e3fc0e740b522b0b785d82cff73fd87a4`, all 54 current source
bindings, graph/cache/worker identities and the raw GPU ledger. Nineteen focused runner/observer
tests pass. Browser and loopback server closed, worker terminated. The fresh profile is retained
temporarily for the next read-only cached Qwen screen; it is not the user's application profile.

Both Arabic outputs are identical: settlement, 12,900 EGP, `14 Aug 2026 09:47 PM`, empty end date,
and the visible success heading required by the current six-field prompt. The reservation output
is IOU, 1,912.15 USD, `Sun, Jul 19` to `Thu, Aug 6`, note `Reservation`; USD is allowed by the
current app-owned symbol policy. This supports these raw fields only: private type/direction,
rendered card, memo/caption priority, missing evidence and both-model prompt generalization
still require their own acceptance checks. No phone, server, APK or Git state changed.

### Dynamic vision source: complete desktop GPU comparison passed

Root executed the six-session plan `90975f518e01ff1a97fefd21300f704a96214be4cf3405c46db3fdd68822d57e`
in the default command sandbox, with exit 0. Receipt
`output/playwright/qwen-vision-host-inputs-20260910-ZFZBNk/result.json` is 3,108,167 bytes,
SHA-256 `575b6f80764ff6a5badaa072ef62c4ae4fb84ab76c1b8a889aa14228fff5824b`.
Arabic/English transfer and missing-evidence processor inputs use unchanged 640/640/616 grids.
Each runs once through the qualified static-grouped graph and once through the new dynamic
graph with the actual production geometry/session factories, on a fresh NVIDIA Ampere device.

All 24 complete output files (31,064,064 bytes) are verified, and every baseline/candidate pair
is byte-identical: 12 comparisons, 3,883,008 FP32 elements, maximum error zero. Native logs
confirm all 1770 nodes on WebGPU in each session, INT64 enabled, NCHW, optimization disabled
and CPU fallback prohibited. All 39 actual private controls match the native reference before
and after inference and are disposed. All 6870 observed GPU buffers are explicitly destroyed
before the six sole, intentional, release-owned device destructions; no buffer invalidation
or unexpected loss is accepted. Browser and loopback server closed; source identities remain
unchanged. The complete 6,297,493-byte/21,258-record console has SHA-256
`c470cfe58b40a2af490497978780d36f2653d6119f241709c287b7292e663a64`.

This is not an additional memory saving: observed logical GPU-buffer peaks are 693,654,832
versus 659,614,000 bytes at 640 patches, and 693,605,680 versus 659,442,528 at 616 patches.
The roughly 34 MB increase is relative to the static-specialized diagnostic, not measured
physical VRAM or phone memory. The unchanged decoder's earlier memory result remains separate.
Nine offline harness tests pass. No decoder, prompt, card, phone, server update or APK build
was exercised by this vision-only comparison. Production entrypoints were unchanged at that
stage; the later source integration is recorded above.
After independent verification and closure, cleanup removed only the regenerable profile and
two superseded, never-executed preparations: 26,866,467 logical bytes, with 27,066,368 observed
free bytes reclaimed. The executed runner, original models/images/account state and evidence
are retained. Temporary removals were not sent to the Recycle Bin.

The generic app-action parser also had a separate acceptance gap: native JSON parsing and an
explicit regression expectation silently kept the final duplicate property value. PR2 now
rejects duplicate decoded names in balanced JSON, including identical values, nested objects,
escaped names, wrappers and mixed batches. Ambiguity rejects the whole batch. Recovery cannot
resurrect a refused object, including a balanced child inside an unclosed envelope. Existing
genuinely incomplete scalar recovery and other parsing tolerances remain unchanged. No
partner-specific fields or logic are involved, and this parser change belongs only to PR2.
Failing-first checks reproduced 16 initial failures plus three unclosed-envelope failures;
266 focused parser/schema tests now pass, including 22 new tests. The root's expanded
seven-file app-action check passes 445 tests. Replaying the recorded ambiguous completion now
rejects it without changing historical result bytes or the other three records' parseability.
Four existing test-fixture typing errors were also corrected without casts or weaker assertions.
The targeted strict TypeScript program, including existing frontend ambient declarations, has
zero diagnostics; formatting passes. This does not claim a full frontend build or new inference.
This prevents an ambiguous proposal; it does not repair the model's source reading. The change
is uncommitted and has not been deployed in the server or APK.

A later memo-only diagnostic retained the seven-field candidate's exact memo instruction,
but removed the other tasks and examples. Only its first of four planned requests ran:
the unchanged 96-token cap was exhausted without EOS after 11,166 ms. The new worker guard
returned only the output-limit error; the harness stopped before the second image or repeats.
Source identity stayed unchanged, hardware WebGPU was observed and browser/server closed.
This is a failed diagnostic, not evidence that the memo is unreadable or a qualified simpler
prompt. Nine offline harness/assessor tests pass, and the assessor rejects the actual runtime
failure. Result `output/playwright/qwen-production-full-model-20260909-PSJQeN/result.json`,
SHA-256 `13b4a024eebb39be7cea9deac854bf43682f0571895df3f87d59148cf9d4232e`.
Its disposable profile was removed after closure (1,858,857,040 logical bytes); model caches
and evidence remain. There was no new server, APK, image-budget or production-prompt update.

The generic model worker now validates actual output token IDs against its effective EOS
configuration before decoding. Normal EOS at the output limit is accepted; exhausted or
unexplained non-EOS completion is rejected without partial text. Input-prefix, count and shape
checks protect both model paths, with generation settings and GPU retirement unchanged. This
addresses a verification gap, not early incorrect content. The 96-token policy is unchanged;
it is separate from the Qwen graph's 1,024-token context guard and has not been raised or newly
qualified on phones. No partner-specific code or field structures are added.
Root checks pass 114 focused tests, 26 model-CI contract/discovery tests and targeted strict
TypeScript. The new production worker-only build is source-bound by receipt
`tmp/qwen-production-worker-only-20260909-7y2Do1/build-summary.json`, SHA-256
`1e3689f0fc26c8aad9d40081ddcfc5296221650c692db0494ac00a234f3fb8e4`, and worker SHA-256
`2d38ee2a6ae9e5bcb93ca178873e1ccf85b370d0325382be1ee44cdf0f45f581`.
Its real Qwen desktop WebGPU guard check passes three predeclared requests on one worker:
normal 96-token allowance, deliberate one-token cutoff, normal 96-token allowance again. Both
normal results exactly match historical bytes. The middle request must return only the exact
budget error; arbitrary failures and partial text do not pass. Existing hardware-GPU, source,
outbound-network and retirement checks passed; browser/server closed. Result:
`output/playwright/qwen-production-full-model-20260909-9XH3GX/result.json`, SHA-256
`a6ff871e4ddc08d12f2db1bb654da0a71c862486c8aa3637edbf65a7ce655e34`.
PR1 now contains the same narrow source change and independently passes 114 focused tests and
targeted strict TypeScript; its unrelated configuration is preserved. This is not fresh Gemma
GPU or phone qualification. The disposable profile was removed (1,864,128,833 logical bytes),
retaining models and evidence. No new APK or server deployment occurred. Historical content
failures remain unchanged; cutoff handling does not correct early wrong source values.

Scope correction: the eight-image prompt comparison is a single-transaction, image-only
diagnostic, not full product acceptance. Its fixed heading rule is a candidate instruction,
not a user requirement. It does not test caption precedence, fresh multi-transaction extraction
or private account-defined type/direction hydration. Additional partner-owned recorded-output
tests now connect actual completions through that partner's normalization, private matching,
user edits and confirmation constructors; the focused three-file run passes 84 tests, including
16 new checks. Constructed multi-row controls are separately labeled. These tests do not exercise
fresh inference, authenticated private transport, encrypted reference delivery or a phone UI.
Keep those missing end-to-end behaviors in the release gate; do not infer their acceptance from
runtime/schema readiness or retrofit older source oracles to make a failed prompt pass.

**Not release-qualified.** The September 9 shared-prompt investigation completed 111 desktop
inferences in 12 batches (55 Gemma, 56 Qwen). The strongest common app-authored candidate
passed the original two images and repeats but failed broader independent source checks.
Across eight distinct images, exact visible-source fields passed on Gemma **7/8** and Qwen
**5/8**; current app-card/confirmation values passed **7/8** and **6/8**, respectively.
These are different gates: app normalization can conceal an incorrect raw model field.
Recorded-output unit tests verify those distinctions, not fresh model accuracy.

The common broad manifest is `admin/common-proof-broad-20260909.json`, SHA-256
`2197598a96e160dd766c6e95a311a4d92014b346fe1511f19bb30fb6f294646e`.
Production-worker broad receipts under the existing project-temp root:

- `output/playwright/gemma-retained-cache-20260909-MRJHTg/result.json`, SHA-256
  `423f590bf9117b957d9c1f545e4df5cb28a59214e7da02d742c11430c5073dcf`.
- `output/playwright/qwen-production-full-model-20260909-voKRPY/result.json`, SHA-256
  `bda7b3d8016cebb11bb4ea5c266241f47d85e71b07b6b21d796209d47af855eb`.

Their runtime/hardware checks pass, but `productionAcceptance` and
`allOperatorsGpuOnlyProven` remain false. Prompt wording, output-field order and image/text
placement affect results; no controlled reference-export/precision comparison has isolated
an underlying numerical cause. No rejected candidate was registered or deployed, and no
model-specific app prompt routing was introduced. Domain prompts, fixtures, field expectations
and interpretations remain exclusively in the app repository.

Before further qualification, freeze one shared prompt and one app-owned missing-value/date
contract, preserving older expectations separately. Require source accuracy and card accuracy
on both models across the development corpus, unused holdouts and repeats; then check the
exact local APK's physical-phone, cache-switching and authenticated app/card journeys. The
three later frozen holdouts are unrun. Earlier tuned synthetic cases are regression evidence,
not fresh holdouts. All-WebGPU remains the production requirement; no reference CPU/WASM
diagnostic would qualify that requirement or become a fallback. Additional reference storage
has now been approved. A no-download native-CPU comparison and three fresh instrumented GPU
requests reproduced the same three raw completions, including two failed source-evidence cases.
The fresh run matched all 12 captured input tensors and three formatted-prompt hashes. A
separate original-Qwen float32 CPU reference reproduced both failure categories with those
same inputs. Therefore those failures do not require WebGPU or quantization; this does not
rule out additional export defects or prove numerical equality between implementations.
The fingerprinted result SHA-256 is
`791a3ced803511fff38d3e27aa2969c323daecb77870bfeb45f526c93cd96357`; the original reference result
SHA-256 is `f711d502525d21481c5ace6506c0dd11c314281eb29debea6a16036f0e55a36b`.
No rejected prompt or production backend change has been deployed. These are additional
diagnostics (three GPU and six CPU calls), not new release-accuracy passes.

Twenty-four later Qwen prompt-ablation requests completed but did not qualify a replacement.
Output-key-only changes alter source selection and missing-evidence behavior; none of those
tested variants satisfies both visible-evidence and absent-evidence cases. These are diagnostic
contracts, not adopted app schemas or changes to the generic host interface.

Three paired Gemma startup attempts ran zero cases. A bounded logging diagnostic identified
GPU subprocess exits with Windows `STATUS_ACCESS_DENIED` (`0xC0000022`) followed by a fatal
browser startup check. The reference-storage approval did not authorize an execution change.
After separate explicit user approval, the same isolated six-case test **completed outside
the command sandbox**, with browser security settings, model/cache identity and prompts
unchanged. This supports an execution-permission cause for startup; the exact denied Windows
object remains unidentified. Successful startup did not repair the source-evidence failure.
Retained model caches and account state remain preserved. Failed logging-result SHA-256:
`d6433487f637870428886bc203d509b1bce925bb24e9d9fa2c1027810828f95d`.
Successful approved rerun SHA-256:
`958bfdecc85086427417c66a3ed930809dd7180149fad479916a2aadbc0020d4`.
Its owned process exited 0, worker/browser/proxy closed, sources and retained cache keys stayed
unchanged. Totals are now **144 desktop WebGPU requests in 18 completed batches (61 Gemma,
83 Qwen)**, plus six CPU reference requests. Runtime completion is not accuracy acceptance;
the shared-prompt release gate above remains failed. No production prompt, worker or APK changed.

A further preprocessing-only comparison captured bounded RGB **before** the JavaScript image
processor. Fresh processor tensors matched all twelve frozen reference identities. Original
Transformers 4.57.6 slow preprocessing, with resizing disabled and original configuration,
independently produced bit-identical pixel values and grids for all three cases (2,912,256
float32 values, zero numerical differences). This checks normalization/channel/patch packing;
browser decoding, orientation and bounded resizing remain shared upstream and unvalidated by
this comparison. It is not a model inference, Fast-processor validation or accuracy pass.
Only 1,456,128 RGB bytes were added, with no duplicated weights/tensors. Browser/server closed,
sources remained unchanged, and 8 capture plus 28 comparator tests passed. Capture SHA-256:
`4544d80ce625544edbe3e26a1b3dcc09677ab4ccbc1d4fccd2eb497343b356b0`;
comparison SHA-256 `4150d4967b463572336254af36016a8b213004930d2dbd001435e2016c2c2972`.

A later fixed-skeleton app-owned candidate failed ten actual Qwen WebGPU checks: only 3/8
distinct inputs (4/10 with repeats) matched both literal source fields and current card/confirm
values. All ten violated the candidate's strict serialization contract. The app-owned
assessment preserves older expectations separately; seven offline checker tests pass without
turning failed model outputs into acceptance. The candidate was rejected before any Gemma or
unused-holdout run. No domain schema, field repair or app prompt was added to OpenChat.
Result SHA-256 `804515291597e061d86fb3ae15f3788b6bd1fb3f5c47c12bb1dd0c9a21af51ea`;
assessment SHA-256 `0f02d3b9dafdffeb75f86dcdfc4a33b83f2a38b4e137fbcecba10108df817684`.
The owned process and browser/server closed, sources stayed unchanged, and separate cleanup
removed its 1.87 GB disposable profile while preserving retained models and evidence. Totals
are now **154 desktop WebGPU requests in 19 completed batches (61 Gemma, 93 Qwen)**, plus six
CPU reference requests. No production prompt, worker, APK or deployment changed.

Two subsequent original-Qwen CPU requests used original source-image decoding and native
slow-processor resolution with the same checkpoint, prompt, template and generation settings.
One input's previously wrong source selections became correct; the other reproduced its
unsupported evidence byte-for-byte. Decoding, resampling and resolution changed together,
so this is an input-preparation finding, not an isolated resize cause or a production fix.
Both outputs still fail strict serialization. Result SHA-256:
`6602fe60fe796d83199b28257a88c5367d8169bc7a6942c9521a0c0a7020a146`.
The owned child exited 0 in 133.344 seconds; 58 bound source/input files and checkpoint hash
stayed unchanged. Twenty-one focused helper tests pass. No new weights, persisted tensors,
browser cache or production files were created; result/log metadata uses 95,538 bytes.
Totals are still 154 WebGPU requests in 19 batches, now plus **eight CPU reference requests**.

A one-request original-CPU control then changed only the slow processor's pixel budget,
verifying identical original decoded RGB, non-image token IDs, model/runtime and generation.
The smaller input reintroduced one incorrect source selection while another remained correct.
This establishes pixel-budget sensitivity for that field in the original implementation,
not a complete explanation of the browser failures or authority to raise phone GPU limits.
Its 320×480 image differs from the browser's 320×512 frame. Result SHA-256:
`1fca6fd68e0978267a4fd2d34824c750125261c74fe8882fcc53d1fabbbfd0d7`.
The owned child exited 0 in 47.906 seconds, with 56 unchanged source/input pins and unchanged
checkpoint hash. Seven focused adapter tests pass; 40,691 metadata/log bytes were retained.
Totals remain 154 WebGPU requests in 19 batches, now plus **nine CPU reference requests**.
No production budget, prompt, schema, worker, APK or fallback changed.

A two-request original-CPU task-isolation control repeats a failed full extraction, then asks
only its unchanged instruction for the unsupported evidence field. Both still invent that
field; the isolated completion reaches EOS after six tokens. Combined-task complexity alone
therefore cannot explain this failure. Same native decoded pixels/grid, model, processor and
generation were verified; task set and prompt length change together. Result SHA-256:
`52d87de64565360bd6958d94577d569380c36b0abd7452c685dc2ef9b6e59bf7`.
The owned child exited 0 in 78.578 seconds; 57 source/input pins and the weight hash remained
unchanged. Six focused adapter tests pass, and 79,521 metadata/log bytes were retained. Counts
at this point are 154 completed WebGPU requests in 19 batches, plus **eleven CPU references**.
This is not a production change or an accepted common prompt.

A subsequent app-owned raw-evidence contract completed ten Qwen WebGPU requests on the
unchanged production worker and image budget. Five of eight distinct inputs (five of ten
including repeats) matched every declared source field. Other inputs still lost visible
evidence or selected an incorrect classification. Seven completions violated JSON-only
serialization; the three unfenced completions had source errors, giving zero complete raw-
contract passes. These diagnostic fields have no implemented app adapter, so no current-card
acceptance is claimed. No partner schema or interpretation was added to OpenChat. The failed
candidate was not deployed or tested on Gemma/unused holdouts. Result SHA-256:
`fa44d4adcf8ecdd0c77773ebda5084c76224837ff477dee8374b501437137287`.
Offline raw-assessment SHA-256:
`8667a7bcb78d14992650f016bc61bb284c0da6a4920c1b6621304dae1f46622c`.
Eight focused checker tests pass; source/worker/graph bindings are verified separately from
the failed extraction scores, without rereading external weight shards.
The process exited 0, browser/server closed and sources remained unchanged. Separate cleanup
removed its 1.87 GB disposable browser profile while preserving evidence and retained models.
Totals are **164 WebGPU requests in 20 completed batches (61 Gemma, 103 Qwen)**, plus eleven
CPU references. Runtime completion remains distinct from source and delivery acceptance.

An eight-call instrumented Qwen diagnostic then compared the two existing app-owned prompts
with frame-fill versus aspect-preserving content inside the same selected frame. All actual
input-ID/mask/grid controls matched across layouts; actual pixel hashes matched across prompts
within a layout and changed between layouts. Original source-image dimensions, production frame
selection, unchanged patch/context limits and absence of decode fallback independently verified.
It uses a diagnostic-only worker with reversible telemetry/layout edits, not an unchanged
production worker. No domain interpretation or schema was added to the OpenChat repository.

Source-field matches changed from 2/2 to 1/2 for the older prompt, and 0/2 to 1/2 for the newer
prompt. One classification improved, but a monetary decimal was lost under the older prompt;
missing visible evidence under the newer prompt remained missing. All eight heading/date fields
matched. Four of eight calls matched all source fields; two were strict JSON objects, and none
satisfied both gates. Existing parser tolerance accepts all eight, so formatting alone is not
being classified as incorrect end-user values. One fixed-order observation per cell cannot
independently exclude order/session effects, and two familiar images do not qualify general,
Gemma, phone or app-card accuracy. This is not a deployable containment fix.

The process exited 0 with hardware WebGPU/runtime/input controls passing and production sources
unchanged. Sixteen builder/adapter tests and seven independent assessor tests pass. Result
SHA-256 `97d307f9a9ca30f4fa21135550f03027ce87687b2ad4c0293fc9aaa00b4a5588`;
assessment SHA-256 `1da8772b8b95c97cb0d7de9ec92a7763a407c06530b42aac8e6006b3d4bf7ec1`.
After verified browser/server closure, separate cleanup removed its 1.87 GB disposable profile
while preserving models and evidence. Totals are **172 WebGPU calls in 21 completed batches
(61 Gemma, 111 Qwen)** plus eleven CPU references. Release accuracy remains unqualified; no
production prompt, runtime policy, APK, app registration or deployment was changed.

A subsequent ten-request shared app-prompt trial used direct questions and a prospective
null-absence convention. It failed every current app-card/confirmation comparison (0/10,
eight distinct regression examples plus repeats), including source classification errors,
unsupported values and one incomplete JSON response. All ten requests completed on observed
hardware WebGPU with the unchanged production worker and budget. Nine reached editable cards;
that did not make their contents correct. Neither the new prompt nor a host workaround was
adopted. No per-model prompt routing or app-specific host logic was added.

The app-owned checker separately tests strict output shape, source evidence, and the actual
current host/app/card pipeline. Its seven offline tests pass, including correct constructed
cases and negative cases; these do not change the failed fresh-inference outcome. Result:
`output/playwright/qwen-production-full-model-20260909-64lwHR/result.json`, SHA-256
`266d8644f6e064cb7adaf3b4635c46fd8b3715af30a0561ae964aa7866e90a92`. Assessment:
`admin/question-null-assessment-qwen-64lwhr.json`, SHA-256
`fbdc4566294d1a3f01da80414e8846adae36441f9b8bc76db4766494c9c9b123`.
The run closed cleanly and its temporary browser profile was removed; models and evidence
were retained. No APK, production worker, server or registration changed. The candidate was
not advanced to another model, unused holdouts or phone acceptance.

A subsequent four-request screen tested one shared app prompt with two in-memory app-schema
alias declarations through the existing generic interface. The unchanged production worker
completed all four on observed hardware WebGPU. Exact source fields and prospective app-card
and confirmation values passed only **2/4**; all four remained schema-ready. Strict unfenced
serialization passed **0/4**, separately from source correctness. The unchanged production
app, without those proposed aliases, passed **0/4 card comparisons**. These are distinct
measurements, not a deployment or compatibility claim for an uninstalled schema.

Fifteen alias-path tests and seven independent assessor tests pass, including valid constructed
cases and rejected conflicts, invalid types, missing evidence and provenance changes. They
verify the actual generic host/app boundary without rewriting raw answers or weakening required
fields. They do not repair the two source-content errors. The prompt changed several elements
together; no single-cause conclusion is drawn. The predeclared four-case advance gate failed,
so no broader, other-model, unused-holdout or phone test followed. No host domain logic or
per-model app prompt routing was added.

Result: `output/playwright/qwen-production-full-model-20260909-X7jota/result.json`, SHA-256
`48df91d61058e05ce46bde17e2aad62f9155b56657b817b2b0b5801bd8b88bc8`. Assessment:
`admin/mapped-aliases-assessment-qwen-x7jota.json`, SHA-256
`673c65e12b57b2e5645d3f4ffe0cbb54da0cbd86146c5eaaf6f361c94d595b3f`.
The process closed cleanly; only its disposable 1.86 GB browser profile was removed, preserving
models and evidence. Production source and APK hashes remain unchanged. Release accuracy is
still unqualified.

The subsequent four-request contrastive-example screen preserved every original prompt byte
and appended only one examples suffix. One absent-source-value error was corrected; the other
three raw completions were byte-identical to the exact baseline. Exact source and actual current
host/app-card/confirmation values passed **1/4**, strict unfenced serialization **0/4**. All
requests completed on observed hardware WebGPU with the unchanged production worker and budget.
Five independently rerun checker tests pass; they retain separate raw, card, absence, example
leakage and provenance checks. This targeted improvement is not shared-prompt qualification;
no broader, other-model, unused-holdout or phone advancement occurred.

Result: `output/playwright/qwen-production-full-model-20260909-I6lr9m/result.json`, SHA-256
`d8e58963ea325bbac289d21333d54efe48393181ad5f1f76162fad7190cb2ee4`. Assessment:
`admin/contrastive-currency-assessment-qwen-i6lr9m.json`, SHA-256
`1b2e47f2f9d12947530038a39671ae1997d2563e3e2f08642af186eea4926b16`.
The run closed and its disposable 1.86 GB browser profile was removed, retaining model files
and evidence. No production prompt, runtime source, registration, server or APK changed.

## Current delivery scope: source preparation and local-test APK

The developer requested a locally testable APK, **not the publisher's signed release APK**.
Use the existing configured local signing identity, local backend/origin and OTA-disabled
all-WebGPU build. Do not require a new publishing keystore, distribution-service credentials
or a publishing versionCode to produce that local test artifact. The publishing-only checklist
below remains guidance for the eventual publisher; it is not a prerequisite for local testing.
Local APK acceptance still requires checking bundled assets, application/account identity,
startup and the model flows. Neither local signing nor successful unit tests proves production
deployment or physical-device GPU acceptance.

The requested review is limited to model-runtime and app/card-interface changes, including
their introduced or changed dependencies. Do not audit or remediate unrelated OpenChat core
dependencies as part of this work. Broader historical advisory and baseline findings below
are retained as evidence, not scoped release blockers or authorization for another whole-lockfile
scan. This boundary does not waive findings or claim security clearance for the feature changes.
The selected local runtime integration gate now passes all 54 app/model tests, not the historical
465-test full-suite attempt; the existing ignored capacity test remains unexecuted. Keep remaining
work finite: resolve the shared-prompt accuracy gate above, finish the feature-scoped
CI/advisory gate within its reviewed roots and authorization, qualify the
remaining phone Qwen/cache-reuse and authentication/card journeys (optional voice if enabled),
and obtain final-stack hosted results. A bounded inventory's incomplete-root disclaimer is not
a mandate to add optional development tools, unchanged core fixtures or a general native C audit.

## Latest local upstream reconciliation

Current local heads are PR1 `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b` and PR2
`d7b94d8649951a5b7d4f46b7d216d41734dd4cf7`, tree
`772e0506315720d0adf36f2a32624ce7e221651b`. PR2 includes that PR1 head through a reviewed
tree-preserving ancestry merge. Both checkouts were clean before this documentation refresh.
The earlier reconciliation commits were PR1 `b461c4b7a3b59daa1d1a4aace002e1d3ffa55d57`
and PR2 `cdceb9d127a329b49a82795662fadba77ab2f18f`; historical validation below retains
its original source-snapshot boundaries rather than being relabeled as final-head acceptance.
GitHub was rechecked on September 9: published PR1 remains `045f7132e`, draft with review
required; PR2 remains `c7299aa11`, draft. Neither reports check runs. The reconciled heads
have not replaced those published heads, and absence of checks is not a pass.
The historical welcome APK predates the final worker-logging and mobile-theme fixes and
cannot represent the reconciled source. Its historical startup acceptance is summarized
below, separately from the newly built reviewed APK.
The September 6 APK and production bundles do not contain the later September 7
welcome-readiness and authentication-error-display fixes described here.
PR1's mixed-owner Git protection required an explicit developer-approved, per-command
trust exception for the exact PR1 checkout before owner-context Git inspection could resume.
That scoped exception is now approved; ownership, ACLs and global Git settings remain
unchanged. The exception permits inspection but does not itself resolve or verify the index.

### September 9 Qwen mRoPE and DeepStack source corrections

Subsequent source safety fix: the pinned decoder has a 1,024-position causal table,
not the tokenizer metadata's larger context window. Both workers now reject
processor-expanded requests when prompt tokens + effective output allowance - 1
exceed that actual capacity, before any generation forward; they do not truncate
the prompt or silently reduce the requested output. Malformed batch/length shapes
also fail before generation, and input tensors still dispose on failure. Gemma is
unchanged. Failing-first execution of the real worker function exposed five
failures; the final 37 focused tests pass in each PR, including an independent
check of the delivered graph's table and scalar dimensions. The 26 model-CI
discovery checks and scoped TypeScript/ESLint checks pass. This is not phone
acceptance or a new full-model accuracy claim.

The generic pinned-decoder transform now targets interleaved mRoPE frequency selection.
Its mRoPE-only intermediate decoder is 5,085,647 bytes, SHA-256
`29df8b402b9dc86a3e2683911f1e4a28067f12713ae3c1715851feb0e39b20e3`;
the pinned source graph and external weights remain unchanged. Isolated CPU and deployed-version
WASM numeric checks passed. A separate desktop WebGPU run verified the actual non-fallback
Nvidia Ampere ORT device and the selector kernels with CPU fallback disabled, including
bit-exact equal-axis controls. The full positional-cache numeric checks allowed CPU fallback;
they are not evidence of fully GPU-resident decoder execution.
Receipts: `output/qwen-mrope-isolated-20260909-aeacf92e-8d42-4229-bfba-e66794e4aca3/result.json`
and `output/playwright/qwen-mrope-desktop-20260909-TaOt3Y/result.json`.

These are weight-free isolated graph checks, not full-model image accuracy or phone acceptance.
The pinned upstream export lacks DeepStack; the mRoPE-only correction did not restore
those learned mergers. That earlier reviewed source-owned snapshot covered 36 files
and the same 18 model dependency roots; the existing ONNX parser/build
dependencies are reused, with no new dependency roots or advisory queries. Both source slices
also passed 26 focused Vitest regressions and 12 asset-notice checks; the new-test typecheck,
read-only ESLint (zero errors) and formatting passed. These checks do not qualify image accuracy.
That intermediate reduced the complete download footprint by 1,734 bytes to **1,534,531,101 bytes**.
Production progress totals now derive from the exact artifact manifest, with an independent
pinned-footprint regression. Its pre-DeepStack 20-file model-focused selection passed **341/341 on
PR1 and 366/366 on PR2**, including the two new cached-decoder upgrade regressions. They verify
actionable refusal before worker creation and decoder-only replacement with retained weight
entries and exact final progress; unchanged weight bodies use explicit bounded fixtures,
while the replacement uses the real build-transformed graph bytes and digest. The earlier
eleven-file offline helper selections passed 273/273 and 331/331, not advisory or hosted-CI acceptance.
These counts do not validate the subsequent DeepStack changes. The September 8 responsive APK
does **not** contain either new graph transform. No APK was
rebuilt for it in this turn; neither the old APK nor these isolated checks qualifies the correction.

Bounded public-reference inspection located the missing 18 BF16 DeepStack tensors in a contiguous
151,080,960-byte range of the immutable original model, using only its 76,240-byte metadata header.
The alternate export's text graph also lacks DeepStack inputs and is not a replacement. A desktop
Chrome probe from an isolated simulated `http://tauri.localhost` origin read an exact eight-byte
HTTP 206 response and its CORS-exposed Content-Range. This proves that bounded browser transport
case, not the real APK, a full shard download, model accuracy or phone memory safety. Receipts:
`output/qwen-header-metadata-20260909-W89GS6/result.json` and
`output/playwright/qwen-range-browser-20260909-mWlwfD/result.json`.

The subsequently approved fixed-range capture downloaded exactly 151,080,960 bytes, retained
the header and per-tensor provenance, and left existing model caches untouched. Its SHA-256 is
`fecb4139b02964dea60cc588fdf3020796cb56280eb89626f2695617f72643d3` (newly captured, not an
independent upstream subset pin). Read-only lossless BF16-to-FP32 expansion produced the expected
302,161,920-byte digest `f331bfc4a32c5dcda5a3589283acd90672f8f903cda0d8f425f8aaaf0b148168`
without writing a second shard. All 18 source tensors were finite. These supplied the
following source integration, not a deployed DeepStack fix or image acceptance. Receipts:
`output/qwen-deepstack-bf16-fixed-20260909-QkCaBK/summary.json` and `tensor-identities.json`.

Current DeepStack source integration pins decoder **5,086,571 bytes** /
`dee3961fa1fe66c37f3f716d44a8daf571e12a4c5c6ce7884f99fe31454e83e8` and vision
**395,100 bytes** / `0b494b36663cc3ce66a34b33fb03e7f722c2957d10db29d55fe63854e7d358be`.
It adds the three learned vision mergers and decoder residual injections, strictly
verified range-to-FP32 weight transport, and per-prompt feature alignment in the
staged WebGPU sessions. Existing source graphs and weight shards remain unchanged;
the additional converted shard raises the manifest-derived installed footprint to
**1,836,700,049 bytes**. Exact source-range and converted-weight provenance is in
`frontend/app/model-asset-notices/MODEL_MODIFICATIONS.md`.

The existing ONNX parser and Noble hash roots now include these new consumers as
evidence, with explicit model-CI trigger witnesses and no added dependency roots.
At that checkpoint the frozen source review covered 38 files and the same 18 roots in each PR;
those snapshots retain the earlier review history. The checkpoint's 24-file model-focused
Vitest selection passed **414/414 on PR1 and 420/420 on PR2**. Earlier totals above
remain historical and must not be added to these overlapping selections.
The eleven offline helper files plus model-CI coverage and asset-notice checks
passed **311/311 on PR1 and 369/369 on PR2**, with zero failures/skips. PR2's
44-file app/OCR review changed only for model graph delivery in the shared Vite
and Rollup files; the other 42 files match its prior frozen snapshot. These
source/fixture checks send no advisory queries and are not hosted-CI acceptance.

A real desktop WebGPU run used the exact shipped JSPI runtime on a non-fallback
NVIDIA Ampere adapter, verified the actual ORT device identity, and disabled CPU
fallback for every session. All three cases passed: post-shuffle vision merger,
zero-feature decoder baseline, and nonzero features across three residual carries.
These use the actual emitted operator nodes with tiny synthetic dimensions and
weights, not full-model inference. Receipt:
`output/playwright/qwen-deepstack-desktop-20260909-jspi-XyZaa0/result.json`.
The separate Asyncify run is supporting evidence, not the shipped runtime.

The subsequent actual production-worker desktop run completed three requests in
the same worker without GPU device loss. Both single-date runs returned the correct
12,900 EGP and date, but fenced JSON violated the strict raw contract. The range
image returned **191215.0 instead of 1912.15**, an incorrect completed-payment kind,
and a guessed ISO currency instead of the printed symbol. Correct range dates do
not qualify that result. Full-model accuracy **failed**; this runtime completion
also does not prove every operator's GPU placement. Receipt:
`output/playwright/qwen-production-full-model-20260909-uaYIgE/result.json`.

Separate same-image diagnostics copied `$1,912.15` correctly in plain transcription
and monetary-copy prompts, while the original prompt and a string-amount variant
still lost its punctuation. This demonstrates prompt-dependent output, not an
implemented fix or a qualified replacement prompt. Receipt:
`output/playwright/qwen-production-full-model-20260909-jxq7Oi/result.json`.
The consuming app's 111 focused tests and 18 actual-PR2-host recorded replays pass,
including qualification rejection despite a schema-ready card/confirmation projection;
the wrong amount and kind stay visible, never heuristically repaired. A passing
negative replay is not successful model extraction.

Four further diagnostic candidates were rejected, including their repeated runs:

- A compact prompt copied the range amount/symbol and dates but omitted its required
  transaction kind; the single-date image gained an incorrect note and omitted the
  required empty ending-date field. All five same-worker requests completed:
  `output/playwright/qwen-production-full-model-20260909-J9JVqq/result.json`.
- A test-only selected-frame-fill worker corrected the range amount but retained
  the wrong kind and guessed currency; single-date output remained fenced. All four
  requests completed:
  `output/playwright/qwen-production-full-model-20260909-s90qbN/result.json`.
- Adding a system role to that diagnostic worker made the single-date transaction
  kind wrong and removed the range ending date while still guessing its currency.
  All four requests completed:
  `output/playwright/qwen-production-full-model-20260909-1SHFDi/result.json`.
- Native Qwen resize geometry corrected the range amount but kept the wrong kind
  and guessed currency; it also changed the single-date image's heading. All four
  requests completed on hardware WebGPU:
  `output/playwright/qwen-production-full-model-20260909-oWe8YY/result.json`.

Stable runtime and individual correct fields do not qualify any of these candidates.
None was adopted at that checkpoint; the production worker and app prompt were unchanged.

A separate six-request production-worker diagnostic correctly classified both
images when asked a short payment-status question or a kind-only question, while
the full extraction baselines retained the range errors. This narrows the
instruction-following failure; it does not qualify a partial-field response or
implement a multi-pass fallback. Receipt:
`output/playwright/qwen-production-full-model-20260909-4sw6Lb/result.json`.

A field-order-only diagnostic then placed classification and currency before the
other four unchanged field definitions. With the production letterboxed image,
classification became correct in both repeats but the range amount still lost
its decimal point. Receipt:
`output/playwright/qwen-production-full-model-20260909-lqBHHs/result.json`.
Combining that ordering with the selected-frame-fill diagnostic produced the
correct amount, kind, printed dates and heading for both images and their repeats.
Receipt: `output/playwright/qwen-production-full-model-20260909-GJVbQe/result.json`
(SHA-256 `f292b08f4a539968562848842757a3fbb9c24f853611304bde760c722bbd7d42`).
These are diagnostic-worker results, not adopted preprocessing or phone acceptance.
The range response's USD is consistent with the consuming app's user-approved
symbol mapping, but violates that historical prompt's literal-copy-only instruction.
The single-date response is fenced JSON, which the host parser supports; raw-format
conformance and actual card data accuracy must be reported separately. Neither
fact repairs or excuses the earlier incorrect amount or transaction kind.
All six combined requests completed on hardware WebGPU without unexpected device
loss. Its completed temporary browser profile was removed after closure, reclaiming
1,868,304,384 bytes while retaining raw results and the original model files.

The unwired native-target experiment was subsequently retired from both release
source slices. One byte-identical helper/spec pair is preserved under
`<project-temp-root>/admin/qwen-native-image-experiment-20260909/`. Its 27 passing
tests, 529 geometry comparisons and three actual-processor RGB cases are historical
experimental evidence, not active release-test counts or phone qualification.
The shipped layout/context/worker-build suites now pass 71 tests in each PR after
retirement. Both latest diagnostic browser profiles were removed after verified
closure; reusable model files and raw result reports remain.

At that diagnostic checkpoint no OpenChat production behavior changed and no new
APK was built or installed. Those historical diagnostics alone did not qualify a
model, deployment, advisory acceptance or release readiness.

#### Subsequent production-worker desktop qualification

The adopted generic Qwen layout keeps the same selected frame and 640-raw-patch
ceiling. It fills only near-aligned frames whose per-axis padding is below 32
pixels and whose additional aspect enlargement is at most 9/8; other shapes retain
letterboxing. This affects model input only, not displayed chat images. Gemma's
preprocessing is unchanged. Geometry tests include 484 dimension pairs, near-bound
negative cases and extreme panoramas.

A fresh, unmodified production-worker build then completed both reference images
twice using the consuming app's actual revised extraction prompt. All four raw
responses had correct source fields and valid unfenced JSON. Actual hardware
WebGPU was observed, with no unexpected device loss and successful worker disposal.
The exact outputs separately passed the real host/app normalization, editable-card
and confirmation-value replay; nothing was posted. This is desktop worker plus
recorded-output app-path evidence, not an actual UI or phone proposal.

- Build receipt: `tmp/qwen-production-worker-only-20260909-SudX1I/build-summary.json`,
  SHA-256 `c6edf739464782f6b0da28de2db1b03d563818a25e9d38f21c0c165165ff6e8d`.
- Production worker: 902,257 bytes,
  SHA-256 `5c86880afd9105ca2f5fd26427420a702ff6719e46397e4f7fb08909c5ca38ea`.
- Model result: `output/playwright/qwen-production-full-model-20260909-heUSm0/result.json`,
  SHA-256 `331552d740b208315eb575277419a3199578a0ee8b02453ed47b14c99ffa1e87`.
- App-path result: the sibling `card-replay-current-policy.json`, all four qualified.
  Its symbol-mapping acceptance is an explicit app-owned policy, not a host-side
  correction or a waiver of the earlier wrong amount/classification.
- App prompt SHA-256:
  `a921746fc62f9e7fe3d8bc4d89f766f92fa57530e832832b0fdd5b97454fcb82`.

The temporary 1.86 GB diagnostic profile was removed after verified closure,
preserving source model files and reports. The corresponding September 9 local APK
subsequently passed emulator cold-start and installed-asset checks as recorded
below; repeated supported-phone behavior remains unverified. The subsequent Gemma
cross-model checks below contradict shared-prompt acceptance. No APK model-inference, all-operators-GPU
proof or complete release readiness is inferred from these desktop requests.

Subsequent cross-model checks used that same unmodified production worker and
retained downloads. The actual shared prompt passed Qwen's four source-field/card
checks but made Gemma misclassify the range image. A payment-proof instruction
candidate passed Gemma, then failed Qwen's range classification, so it was
reverted without updating app registration. Three further generic kind-instruction
candidates failed at least one model or required field. Valid JSON and successful
GPU execution were not counted as field accuracy.

The next two heading-instruction candidates were also rejected before any Qwen
rerun: one omitted the single-date image heading; the other omitted the range
ending date. Both repeated the same error, qualifying only two of four field/card
checks each. All eight requests completed on hardware WebGPU in the same worker;
all 13 retained cache bodies were verified and the browser/proxy closed. Source
and cache keys were unchanged. Evidence:
`output/playwright/gemma-retained-cache-20260909-H3cpLs/result.json`, SHA-256
`bf5736cee53d486313f2b5d943d145fb463334e386d91f9a82c2f9ccf09a4f9b`,
and sibling `candidate-field-check.json`, SHA-256
`68d95a31747307ef264d2e0ed4744825f07a842068ff55ea2c1d6f3574b085a3`.
These are rejected app-owned prompt diagnostics, not a host-specific field repair,
live registration update or physical-device qualification. The actual source prompt
remains at the `a921746f...` identity above.

The three subsequent field-order candidates also failed: all omitted the range
ending date, and only the payment-proof ordering preserved the single-date image
fields. Their twelve same-worker requests completed, but their independent field/card
qualification counts were 0/4, 0/4 and 2/4. Evidence:
`output/playwright/gemma-retained-cache-20260909-XYWiLX/result.json`, SHA-256
`85b622148815c0b24e1237ba774efe365d4036607f24ecbcac27d7e2d95b65a9`;
its field-check report is `08a084e4078a050c381618cae934ce1dabda31566e27f7e19a20b9d689202260`.

A shorter, app-only prompt (`9028b11d...`, 1,616 bytes) was tested next without
changing the production worker, image inputs, model files or expectations. It
preserved the single-date image's visible values but emitted single-item arrays;
the strict single-object check therefore rejected all four outputs. More
importantly, the range image returned `Jun 19` and an empty ending date twice,
contradicting its visible `Sun, Jul 19` / `Thu, Aug 6` interval. This candidate is
rejected regardless of array-format handling. Source and live registration were
not changed. All requests terminated, all 13 retained model bodies were checked,
and the browser/proxy closed without model downloads or cache copies. Evidence:
`output/playwright/gemma-retained-cache-20260909-FyzRDw/result.json`, SHA-256
`6e955992cb95be618ef3e5757bb3cb557ba7c6b677a380ba1d947c2a69f84722`;
strict/offline checker report SHA-256
`9c4943924462dcd5df07f58259e3fc7d18dbd388e87183ff59472f03dd9d8e2d`.

The subsequent replay resolves that format distinction: the unchanged production
`parseExtractionList` and `runAiAction` already accept singleton arrays (4/4).
Actual host/app normalization, card initialization and confirmation preserve all
single-date fields (2/2), but both range cards still have an empty date and no
interval in the note. Thus host/card field qualification is **2/4**, while strict
single-object formatting remains **0/4**; neither result qualifies the candidate
overall. No parser, expectation or model output was repaired. Replay evidence:
`output/playwright/gemma-retained-cache-20260909-FyzRDw/candidate-host-array-replay.json`,
SHA-256 `5d96e98d1f44ea2295ef8dc482adb05108477e0edf4b1e880a784a72021b8933`;
72 source bindings were verified unchanged. This is recorded-output replay,
not another model execution, UI proposal or live registration update.

### September 9 feature-scoped CI follow-up

The three npm jobs now invoke only the reviewed source/seed/lock-bound feature
advisory runner, with independent offline license checks and retained diagnostic
artifacts. Consumer-only PR2 changes cannot skip its source-bound gate. The focused
offline selection passed 239/239 on PR1 and 323/323 on PR2; npm-only wiring CLIs,
seven-file formatting and scoped Git whitespace checks also passed. These overlap
historical helper selections and are not additive totals or hosted-CI acceptance.

The current PR2 offline collection covers 18 model roots and 17 app/card roots,
selecting 319 public package names / 323 versions. Local package names, source and
account data are excluded from its proposed external request. Approval review
rejected that request before process creation because this dependency metadata
export needs explicit user permission. No query was sent; no retry or alternate
endpoint is authorized yet. Evidence:
`tmp/npm-feature-advisories-Lk3EZY/summary.json` and
`admin/release-advisory-query-approval-needed-20260909.json` under project temp.
Legacy whole-lockfile Rust/SBOM commands remain intentionally fail-closed until
legitimate feature-scoped replacements and actual evidence are available. No
unrelated OpenChat core audit is authorized by this remaining work.

The feature-scoped Rust transport and offline SBOM exporter are now implemented
in both PR worktrees. A fresh six-file selection passes **160/160 per PR**, with
zero skipped tests, including 41 transport tests and 29 exporter tests. The
exporter regression proves that identical local manifests with different reviewed
source snapshots do not merge into one component. The mirrored transport and
exporter hashes are respectively `4f8257e7...` and `e4b440f4...`.
Evidence: `<project-temp-root>/admin/rust-feature-implementation-offline-20260909.json`,
SHA-256 `24986cf96ee37616650c8c104825df86455782bdcaffd8035fdeac671b1f32c9`.
These are mocked/offline implementation checks, not real advisory queries,
official CycloneDX 1.6 schema validation, a current exported project SBOM,
hosted CI or release clearance. Unassessed Git dependencies, bounded coverage
and producer/freshness requirements remain explicit; the guarded legacy workflow
steps were not bypassed or silently skipped.

### App-owned complete-timestamp normalization evidence

The consuming app separately rejected a correctly copied complete timestamp in
its newer printed-date path, even though the legacy date path accepted it. The
app-owned single-date parser now validates an optional 12/24-hour clock suffix
without timezone conversion, borrowed years or changes to interval parsing.
After 13 failing-first cases, 255 focused tests pass, including app processing,
editable-card and confirmation date retention. Invalid clocks, missing end
markers and conflicting date representations remain rejected. This corrects
date normalization, not the model's incorrect kind, amount or heading; the
prompt and raw-output oracle were not relaxed. Served desktop-module delivery
is verified below; the actual signed-in app/phone/APK journey remains unverified.

The combined seven-file app selection subsequently passed **374/374**. The
actual current PR2 host replay passed **20/20** recorded cases/controls with no
posting capability. The exact captured, fenced full-timestamp response now
preserves all expected card/confirmation fields; its strict raw-format check
still fails. A separately labeled wrapper-only synthetic control passes the
unchanged strict oracle against its own source-backed full-timestamp fixture.
Wrong printed minutes fail source fidelity even when the normalized card day
matches. These are regression/replay results, not a new model or device pass.

A fresh desktop Chrome context then executed the actual Vite-served app
postprocessor, editable-card and confirmation modules. All six timestamp and
negative-control checks passed with unchanged source hashes, no unexpected
requests, and empty account storage. The browser and its temporary profile were
closed/removed. This verifies the running local app modules, not the full UI,
account linking, remote registration or packaged APK. Receipt:
`output/playwright/iou-served-timestamp-20260909-UmFJWF/result.json`.

### September 8 native, build and integration evidence

- PR1 passed all five Windows native gates at `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b`:
  18 default-feature tests; `inference` and `inference,store` compile checks; 32 inference
  tests with four existing ignored fixtures; and one explicitly selected real CPU-text test.
  All commands used `--locked --offline`, exited 0 and preserved all 456 recorded inputs.
  Receipt: `tmp/pr1-native-gates/launch-40864d6bc3ae4da2888c79d94e6ef6d4/summary.json`.
  This is Windows native/CPU evidence, not Linux, image quality or phone WebGPU acceptance.
- PR2 built all 25 canister WASMs at `d7b94d8649951a5b7d4f46b7d216d41734dd4cf7`, preserving
  all 2,873 recorded inputs and tool identities. Build receipt:
  `wasm25-1da8bf10e18647f1b65cbddba22d46ac/summary.json`.
- The complete integration executable compiled and linked successfully at the same PR2 head:
  `cargo test --locked --offline -p integration_tests --no-run --message-format=json`.
  All 2,873 inputs and the lock/tool pins were unchanged. Receipt:
  `tmp/pr2-integration-link-runs/launch-d668368c90a04bffb09f9f2a3031d412/summary.json`.
  `--no-run` proves build completion, not test execution.
- The subsequent unfiltered integration run selected 465 tests with one existing ignored test.
  PocketIC setup failed while binding a Linux AF_UNIX socket in Windows-backed temporary
  storage: `Failed to bind path` / OS code 95, `Operation not supported`. Shared setup failures
  cascaded; the exact owned driver was stopped, and no matching run-local server remained.
  This is a failed environmental setup, neither a product pass nor a proven product regression.
  Receipt and stderr:
  `tmp/pr2-full-integration-c779802401f245ee8adc83e92ab1dad6/logs/runtime-6e3af8fd69944a92b4f7e0d95a3cd1b2/summary.json`.
  That socket failure and the subsequent 2.2 GiB disk preflight failure are historical.
- The user-approved project-owned RAM socket plan then executed the selected 54-test gate.
  Its first run returned 26 passed / 28 failed / one ignored, with 411 filtered. Failures grouped
  around stale first-page directory lookups, invalid test card rows and a legacy ingress
  expectation. Three integration-test files were corrected without production/WASM changes or
  weaker security assertions. The original source-bound failure evidence is retained under
  `<project-temp-root>/tmp/pr2-selected-integration-3a948fa46f684ef4b748d463489e92fe`.
- A fresh source-bound harness-only relink and second run returned 52 passed / 2 failed /
  one ignored, with 411 filtered. Further diagnosis identified platform-dependent LF/CRLF
  public-key text and a stale expectation that cancellation could discard a pending
  confirmation lease. This red evidence remains retained, without rewriting or waiving it:
  `<project-temp-root>/tmp/pr2-selected-integration-45b05627a0274980aa41b75cf5ed562c`.
- The final fixture-only correction compares canonical LF public-key text and preserves the
  pending lease, actor restrictions, repaired-key retry and exactly-once encrypted delivery
  assertions. A new source-bound harness-only relink then passed the same selected gate:
  **54 passed / 0 failed / one ignored**, with 411 filtered, in **186.35 seconds** (exit 0).
  All 2,873 recorded compilation inputs remained unchanged during relink and execution;
  only the three reviewed integration-test files differ from the original WASM producer.
  All retained production/WASM inputs, fixture pins and lock identity remained unchanged.
  Receipt: `<project-temp-root>/tmp/pr2-selected-integration-7380b7fc33de4badb35cd6cebe905f0f/summary.json`,
  SHA-256 `56fc4d7f9c51a25c22fe1d9689bcdbc1a7e7b49a1ec993218ff2d11aa9e8a20e`.
  The exact owned Linux processes and RAM child were removed. The disposable Windows
  state was subsequently removed with all 64 retained evidence/artifact hashes unchanged;
  its separate `windows-state-cleanup.json` records the checks without modifying the pass receipt.
  This closes the selected local Windows-harness/Ubuntu-PocketIC functionality gate, not
  hosted native-Linux CI acceptance. The existing ignored capacity stress test was not run.

Native, build and selected local integration gates above are complete; supported-phone
repeated WebGPU inference, optional voice/cache/account retention, authenticated app-card flows
and final-stack hosted checks remain outstanding. Fresh app-card inspection on the old APK
passed as described below. The September 8 runtime-fix APK is now built and binary-verified,
and was subsequently installed over the emulator's existing app. Its first cold-start probe
failed on an ADB attachment timeout; later read-only UI/assets inspection passed. Neither
cold-start nor physical-phone qualification follows from that inspection.

After the selected integration gate passed, its completed Rust incremental/object cache was
retired during the requested project-temp cleanup. All 106 protected APK/native/harness/WASM
identities and 2,889 retained runtime/unknown files stayed unchanged. Cargo's generated
`.fingerprint` metadata was also removed so a future build regenerates deleted compiler outputs;
this is no longer a reusable warm compiler cache. The recorded integration pass and retained
executable/fixture evidence remain valid. Receipts:
`tmp/completed-backend-incremental-cleanup-b0f415fdd09147369dd6c3c4079e2747/summary.json`,
`tmp/completed-backend-objects-cleanup-dea0018ee1c143fc908870fd5fbd22f2/summary.json` and
`tmp/completed-backend-fingerprint-invalidation-5e3a3b819b84444e9e8a358b882f726a/summary.json`.

Phone preflight (September 8): installing the exact reviewed September 7 APK over the existing
app succeeded without uninstalling or clearing data. The existing signed-in account/chat list
was visible, the installed frontend reported `2.0.0-local-webgpu-reviewed-20260907` with OTA
`none`, and the secure packaged `http://tauri.localhost` origin returned a non-null WebGPU adapter.
Model settings still selected Gemma and recognized Qwen as downloaded; optional voice support
remained uninstalled. These are UI/capability observations, not model-file hash verification,
cache-reuse inference, passkey authentication or full account-retention acceptance. The 228 ms
activity launch timing is not a measured UI-readiness deadline. No inference or authenticated
app-card flow ran in this preflight. Android denied native input injection with `INJECT_EVENTS`,
so the next long-press interaction requires the user; no permission bypass was attempted.

A separate read-only inspection then hash-verified all 26 packaged runtime/graph/notice assets
on the physical phone against the reviewed APK's distribution manifest. Version, OTA-none,
secure packaged origin and non-null GPU adapter checks also passed. Receipt:
`output/playwright/phone-release-20260908/packaged-assets.json`, bound to distribution SHA-256
`52643e2f45af8fd4b1d1b12021dde37b143a6b3c60f431e72b65b007f5d213d9`.
These are packaged-asset and GPU-capability checks, not downloaded-weight verification,
model inference, cold-start timing, passkey authentication or app-card acceptance.

The user subsequently triggered one image proposal in the real APK with Gemma previously
selected in model-only mode. It progressed from image processing to a verified, editable
app-authored card, with confirmation enabled. The app-owned fixture's expected values,
user-defined classification and complete visible date interval matched the final card.
The frame had no material horizontal overflow (337 px viewport/document, 338 px body).
Receipt: `output/playwright/phone-release-20260908/reservation-first-proposal.json`.
No confirmation or inbox delivery was exercised. This establishes one proposal-to-verified-card
case, not repeated-run stability, per-stage GPU telemetry, a network/OCR trace, optional voice,
the other image/model cases or a complete authenticated confirmation/delivery journey.

The user's second proposal, using the multilingual portrait receipt without restarting the
APK, also reached a verified editable card. Its amount and currency matched, but its expected
transaction date was empty. This is a failed semantic acceptance case, not a passed two-run
qualification. The APK process remained the same; renderer identity and per-stage GPU telemetry
were not captured, so this does not establish full runtime stability. The card had no horizontal
overflow and no confirmation was pressed. App-owned evidence is retained outside this repository
in `output/playwright/phone-release-20260908/arabic-second-proposal.json`.
The then-live app manifest matched the app source. A separate real packaged-worker diagnostic
with the same source image and that app prompt reproduced an incomplete app-owned value,
which app normalization omitted. Its raw result is retained only in the app-owned evidence
directory as `arabic-worker-current-prompt.json`; it was not a new chat proposal or confirmation.
Subsequent experimental app prompts were rejected for missing or incorrect values. One matched
the portrait receipt but failed the range-image case under the same prompt, so a single-image
improvement must not be treated as a shared-contract qualification.

A revised app-owned extraction contract subsequently produced matching complete outputs for
both exact source images twice each in the physical phone's packaged worker. Three awake runs
took 32–34 seconds; one repeat was prolonged by device sleep and is not normal-latency evidence.
All four captured outputs passed the then-selected date/type/note checks through the app's
normalization, editable-card projection and confirmation-payload code. Those expectations
excluded direction and accepted a guessed currency code; they are not full qualification.
The app pins both recorded cases to that earlier prompt's bytes, and its actual-host replay
retains earlier malformed/incomplete outputs as failed cases.
Receipts remain outside this host repository in the app-owned evidence directory, including
`printed-pair-four-run-acceptance.json`. This is real worker inference followed by code replay,
not four end-to-end UI proposals, backend attestations, or confirmed deliveries.

The local app registration was updated and republished with its matching backend commitment;
the strict anonymous checker verified the published schema and exact binding. No OpenChat model
runtime, packaged assets or APK changed for this app-only repair. After refreshing the APK, the
user made fresh proposals for both source images. Both reached verified editable app frames,
with enabled confirmation and matching amounts, entry kinds, expected dates and notes;
the interval image also selected the expected user-defined classification. Both frames
had matching 338 px viewport/document/body widths. App-owned receipts are
`printed-pair-single-date-fresh-proposal.json` and `printed-pair-range-fresh-proposal.json`.
These captures establish the recorded date/classification/note and layout results for that
configuration, not a complete proposal qualification: direction was not checked.
Subsequent source-image review found an overclaim in the currency expectation: the interval
image contains a symbol, not an explicit ISO code. The earlier receipts preserve the displayed
currency match but do not prove that the model followed the code-only extraction instruction.
The app acceptance fixtures now retain those captured outputs as overall unqualified while
separately recording the successful date/type/note checks. The user approved the app's existing
symbol-to-code policy. Literal-token extraction plus app-owned mapping has now passed the four
real packaged-worker runs below and is published in the newer local revision recorded there.
No host-specific mapping is permitted.
The reconnect interaction itself was not observed, and no confirmation or delivery was exercised.
Older pending cards still bind the previous revision. Do not equate these two UI passes with
all-model, optional-voice, full authentication or end-to-end delivery acceptance. No app-specific
repair belongs in this host.

#### Current literal-currency and direction follow-up

The current app-owned prompt changes only the currency instruction: copy the visibly printed
code or symbol literally; do not expand a symbol into a code. Its exact SHA-256 is
`2ed2358df07dc8c42a25eb8c3b6b27f183202c384dc460335d7d476fde34bda1`.
Both original images now pass twice in the actual packaged-phone Gemma 4 E2B worker at 96
output tokens: the portrait receipt took 33,396 / 32,757 ms, and the interval image took
34,205 / 33,034 ms. The raw symbol is retained by the model; only the app's approved existing
policy turns it into the card's currency code. Receipts remain app-owned:
`arabic-worker-currency-copy.json`, `arabic-worker-currency-copy-repeat.json`,
`range-worker-currency-copy.json`, and `range-worker-currency-copy-repeat.json`, under
`output/playwright/phone-release-20260908`. These are real inference outputs followed by
app/host code replay, not fresh verified UI proposals or confirmation/delivery runs.

The separate app-owned direction bug was in saved-type hydration: selection of a saved type
did not apply its saved direction when private data arrived. The app now applies that direction
with manual-edit and readonly protections, generically across user-defined types. No category
keyword, app field interpretation or repair was added to OpenChat. The old `c79e08cb…` prompt/UI
captures excluded direction and accepted a guessed currency code, so their narrower passing
assertions did not detect this bug and must not be described as complete qualification.

The latest complete app-side unit run passes 1,738/1,738 tests. The preceding
1,654/1,654 full run in 104 files and 922/922 focused selection in 49 files remain historical.
Both application TypeScript checks pass, and all 17 recorded-output replays through the actual selected OpenChat
host pass. Historical failed model outputs remain rejected; a passing regression replay is not
a new model success. The app's production-mode frontend candidate also built successfully in
an isolated external app-owned directory under the project's temporary root, documented in the
app's own readiness notes. It predates the later app normalization correction and is not a
deployment, APK update or new phone acceptance.
The updated app definition is now published locally as revision
`1788864441555`, replacing `1788862105373` and the earlier `c79e08cb…` prompt. Anonymous read-back
verified the full regenerated response schema and exact backend manifest commitment. Existing
registrar/administrator identities were reused without owner changes, account resets or production
deployment. Loopback HTTP 200 checks verified the direction assignment and labels in the delivered
app modules. A PowerShell Tailscale HTTPS check failed TLS authentication without a certificate
bypass; phone/Tailscale UI acceptance is not established by the loopback result.

At `2026-09-08T10:54:29.928Z`, a fresh user-triggered physical-APK proposal passed read-only
rendered-card inspection, now including the saved type's direction and its matching display
label. The amount, currency, kind, date, complete interval note and saved classification also
matched the app-owned expectation. Exactly one verified editable frame and one enabled
confirmation control were present; viewport/document/body widths were all 338 px. Receipt:
`output/playwright/phone-release-20260908/literal-currency-range-direction-proposal.json`, retained
outside this repository with the app-owned field values. The card revision was **not captured**;
the source/manifest verification for `1788864441555` above is separate evidence, not a revision
assertion about this captured card.

The inspector did not press confirmation or independently read backend delivery. The user then
explicitly reported that the app's add/confirmation action appeared correct. Delivery is therefore
**user-confirmed**, not independently backend-verified; the receipt retains its original
`confirmationClicked:false` and `deliveryVerified:false`. No reconnect journey was independently
observed, and this does not close the complete authenticated-journey gate.

The phone temporarily disconnected: device and forwarding inventories were empty, and the
read-only Qwen/cache/audio preflight could not attach. No forward/reset, selection, download,
cache mutation or inference was attempted. Its `model-cache-preflight-blocked.json` is retained
in the same external evidence directory. Earlier model-manager hints are not current cache
verification; Qwen inference/cache reuse and optional-audio acceptance remain unverified.
The phone later reconnected; cached base-model metadata matched and actual UI selection attached
Qwen while preserving the other downloaded model. One user-initiated Qwen all-WebGPU image
completion ran on the retained September 7 APK. The app rejected an unsupported localized value;
its app-owned normalization fix and exact-output replay are recorded in the app repository, not
implemented in OpenChat. Live HTTP 200 module checks do not establish a fresh phone proposal.
USB subsequently reconnected. At `2026-09-08T12:21:00.404Z`, a fresh multilingual receipt card
passed its app-owned expected-content, enabled-confirmation and width checks on the same
retained APK. Receipt: `output/playwright/phone-release-20260908/arabic-post-localized-date-proposal-card.json`.
The older failing card remained separately identifiable and its evidence was not rewritten.
No confirmation/delivery, card revision, new raw output or fresh model identity was captured
in that repeat; this is a narrow app-card pass, not complete model or authenticated-journey acceptance.

The subsequent user-triggered Qwen interval-image case **failed semantic acceptance** on that
September 7 APK. The current app prompt produced complete JSON in 34,894 ms at 96 output tokens,
but the amount lost a decimal digit, the ending date was empty, and entry-kind/currency values
did not match the app-owned expected content. The actual rendered card also failed at
`2026-09-08T12:41:33.990Z`, with a wrong amount, empty date and incomplete note, even though its
confirmation control was enabled. No confirmation was pressed. No GPU crash was observed in
this recorded completion; successful inference transport is not extraction-quality acceptance.
The exact source values and raw app schema remain outside this host repository in
`output/playwright/phone-release-20260908/qwen-range-proposal-trace.json` and
`qwen-range-proposal-card.json`. The actual-host/app replay now checks 17 recorded
cases and passes its negative contract assertions, while explicitly reporting
`modelImageAccepted:false`, `strictRawAccepted:false` and `fullCardAccepted:false` in
`qwen-range-current-prompt-failed-replay.json`. That replay is not another inference or a
passing Qwen case. This failed output is also retained in the shared app-owned negative fixture.
Subsequent date-first and transcription prompt probes both failed their app-owned image-content
acceptance without observed GPU errors; neither is a qualification pass or a host-side repair.
The phone subsequently disconnected; no newer APK was installed there.

The generic September 8 runtime fixes distinguish full-weight cache verification from stale-worker
refresh and preserve downloaded models. Cached SHA updates are bounded to 64 KiB and yield a
macrotask after 8 ms of hashing or 4 MiB, allowing UI/cancellation progress. Failing-first
stale-worker, model-preservation and prequeued-stream starvation/cancellation regressions pass
106/106 focused tests on PR1 and 111/111 on PR2; ESLint has zero errors and four existing catch
warnings. These runtime changes are included in the newly built locally signed September 8
test APK described below; the installed September 7 artifact predates them. The new artifact
has emulator install-over and read-only UI/assets evidence below, but no accepted cold-start
or physical-phone test. It changes runtime responsiveness,
not the app prompt or the demonstrated Qwen image-accuracy failure. Repeated inference,
optional audio, cache/account retention and authenticated journeys remain separate gates.
Release acceptance remains incomplete.

### September 8 scoped CI follow-ups (uncommitted)

A separate standard-Linux integration workflow now covers the stacked app PR base and the
named app-interface branches. It selects all 54 normal app/model integration tests in one
harness process, records the existing ignored capacity test separately, and rejects incomplete
inventories, wrong outcomes, dirty source and mismatched fixture bytes. It does not replace
or alter the upstream full-suite workflow. All five cached external fixture pins were rechecked.
The runner/workflow checks plus existing CI policy tests passed 37/37 locally; actual Linux
integration execution and cold hosted-runner capacity are still unverified.

Automatic frontend install commands explicitly use `npm ci --no-audit`, with regression
checks rejecting removed or overridden flags. The earlier focused selection passed 48/48 in
PR1 and 95/95 in PR2; those remain historical selections, not current full-aggregate counts.
Both real, unfiltered `frontend.yaml` workflows have the separate
**Check offline feature inventory and CI contracts** step, initially with nine test files:
the npm scope, seed review, advisory and independent advisory-review helpers; Rust scope,
seed review and advisory helpers; feature-CI contracts; and the legacy-mode scope guard.
The new guard validates the actual single-line workflow run, each omission, commented/conditional/
ignored runs, repository-root working directory and inherited shell. Those nine helpers plus
`model_ci_coverage.test.mjs` passed **262/262 on PR1 and 304/304 on PR2**, entirely offline,
including four failing-first YAML-scalar regressions.
The September 9 step contains eleven files, adding the offline Rust advisory-response
validator and owned-rule regressions. Before the DeepStack follow-up, the full selections passed **273/273 on PR1 and
331/331 on PR2**, with zero failures/skips. No advisory requests were sent, and no supplied
response fixture establishes freshness, service authenticity, complete root coverage or
release/security acceptance.
These are offline wiring/fixture checks, not hosted execution or overall CI acceptance.
The later runtime-source and three integration-test source pins were refreshed in their bounded
feature inventories; the targeted source-binding guards pass 8/8. No dependency or advisory
clearance follows from those pin updates.

No advisory service was contacted. The mode guard rejects the legacy `npm`, `rust`, `sbom`
and no-argument invocations before reading baselines or invoking subprocesses/network calls.
Explicit `ci`, `licenses` and PR1 `format` checks remain available; license metadata resolution
now requires both `--locked` and `--offline`. Unknown modes are errors, not successful no-ops.
The actual workflow still contains old whole-lockfile commands which intentionally fail closed;
overall CI therefore remains incomplete, not skipped or green. The offline feature step is
already wired; replacing the remaining guarded commands and obtaining authorized scoped
advisory evidence are separate unfinished work.

The subsequent feature-only advisory egress attempt was rejected by the approval gate and awaits
explicit user approval. No advisory query succeeded, no whole lockfile was uploaded, and no
fallback or permission bypass was attempted. Offline inventory/helper results must not be
reported as advisory acceptance. This permission gate is separate from the now-user-approved
RAM-backed integration socket request; the selected local runtime gate now passes all 54
ordinary tests, with its one existing ignored capacity test still unexecuted.

The historical PR1 wllama-only npm ownership and PR2 no-npm-delta/four-Rust-package lists were
insufficient for today's feature changes. The replacement inventories now select reviewed
feature-used roots and their locked reachable dependency closure, rather than uploading either
whole lockfile or treating those older lists as current coverage. PR1 includes Transformers,
wllama and ORT; PR2 adds Tesseract/core and Arabic/English data, with reviewed shared consumers.

The subsequent September 9 direct-feature ownership review records the dirty working tree,
not the committed `sourceRevision` bytes or an exact delta from the last working-tree review.
It covers 40 model files / 18 roots in each PR, including the staged-session transform helper,
and 44 app/card/OCR files / 17 roots in PR2. The reviewed fingerprints are recorded in
`scripts/npm_feature_scope.pr1.json` (`15b5f9c2aeca637788d71bf1b0474ec4e067c590240227aaf0b1955500e3bd7e`
for PR1; `3aafb847e7aad846a15843fac6278050ecc88a59481aa48b6309767e7c923c96` for PR2)
and `scripts/npm_feature_scope.pr2.json`
(`52264e99f73f8bd8bff300dba20d49820e7c7aa5395b74b136aa57e69d8310ab`).
Full ownership-helper selections passed 31/31 in PR1 and 58/58 in PR2, and their CLIs
returned exit 0; these counts are terminal-reported, without a separate saved run receipt.
This resolves the stale ownership fingerprints noted at experiment retirement; it neither
changes historical receipts nor establishes advisory, security, runtime or phone acceptance.

Fresh optional-audio/cache/composer unit selections also passed 273 tests in PR1 and 319 in
PR2 (592 total across the two slices), with 33/37 recorded source inputs unchanged. Receipt:
`tmp/audio-cache-composer-20260909-g6cq4W/summary.json`, with per-PR JSON reports and
before/after source identities. These overlapping selections must not be added to earlier
aggregate counts. No audio/model inference, download, phone interaction or cache mutation ran;
actual optional voice-message inference remains unverified.

Rust extraction and offline request-plan validation are now complete for eight target/feature
profiles: four from PR1's own metadata with **183 unchanged dependency inputs**, and four from
PR2 with **190 inputs**. The earlier 190-input metadata observation belongs to PR2, not PR1.
Receipt: `<project-temp-root>/tmp/rust-advisory-offline-plans-e8cUoE/summary.json`.
It records **474 PR1 / 473 PR2 registry queries planned, none sent**, and seven Git identities
separately unqueried in each scope. `advisoryChecksPerformed:false` and
`rootCompletenessVerified:false` remain explicit. No additional missing Rust root was concretely
identified: the latter is a bounded-coverage limitation, not a reason to expand into optional
development tools, unchanged core fixture code, or a general native C audit. Workspace-resolved
feature unions and unqueried source kinds are retained as limitations, not silently approved.
No advisory query, inventory upload or current security clearance follows from these offline
plans; historical findings, digests and expiry dates remain unchanged.

| Local validation (scope described below)         | Result                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Full frontend Vitest                             | 190 files / 2,550 tests passed; none skipped                  |
| Svelte / agent TypeScript                        | Svelte: 0 errors / 562 warnings; agent `tsc`: passed          |
| Read-only ESLint                                 | 0 errors / 31 warnings                                        |
| Offline build/CI/security-helper regressions     | PR1: 104 / PR2: 340 after launcher CI routing repair          |
| Focused Candid source contracts                  | 38 passed; includes method-name sets for all 25 interfaces    |
| Full generated Rust/Candid parity                | 25 generated interfaces / 50 strict comparisons passed        |
| Full backend unit workspace                      | 957 passed / 0 failed / 1 existing ignored test               |
| Full backend strict Clippy                       | Passed, including integration-test compilation                |
| Targeted user action-card tests                  | 12 passed                                                     |
| Native default-feature OTA tests / strict Clippy | 27 passed / passed                                            |
| Android component registration                   | 12 host tests, 7 SDK checks and Android 36 compilation passed |

Windows native validation on PR2 `4f9acad2b26b61623836b7652831f2df78702716`
passed locked/offline `open-chat` checks with `inference` and `inference,store`.
Plugin library tests passed 27 default-feature tests and 41 inference-feature tests;
four fixture-dependent tests were ignored in the latter selection. All 279 recorded
native inputs and Cargo.lock were unchanged. Receipts:
`native-feature-runs/launch-0a709def843a40d0850ca5ff4d94d969/summary.json` and
`native-feature-runs/launch-f22a4fbf6640401c90f8a7a170442111/summary.json`.

After the CI-only commit `bdb5c00ff1c9c4c5ee2f805affed94f2f29b8750`, the exact
`inference::tests::text_inference_smoke -- --ignored --exact --nocapture` Cargo selection
also passed with `--locked --offline`: one test executed, none ignored, 44 filtered out.
The workflow's immutable TinyLlama fixture matched its 13,893,600-byte size and SHA-256
`a439d0bbdce924ff1a32f68b7b2dd7fa0b98687f7eb6e7e55206527b446362af`.
The same 279 native inputs and lock remained unchanged. This executed real Windows CPU
generation, but asserts only non-empty text; the output was repetitive and the runtime
warned that its context exceeded this tiny fixture's training context. It does not establish
answer quality, structured output, vision, Linux, phone WebGPU or app-card acceptance.
Receipt: `native-feature-runs/text-68a57f415c22446d9820ccca4b274f34/summary.json`.

The component fix registers actual app classes independently of the installed application ID.
It preserves notification payloads and supports the local identity profile without changing
the upstream namespace. Host tests do not prove Android runtime behavior or account retention.
The opt-in local identity profile has produced a binary-verified APK. Runtime acceptance
remains partial; physical-device inference and account/model retention are not established
by an install-over operation or host component tests.

Independent review also caught a recovery-screen chunk dependency: when the stale-worker
recovery chunk could not load, startup mounted nothing. The lightweight recovery component
is now eager while selected app layouts remain lazy; an actual-entry regression failed before
the fix and passes afterward. The optional Android credential-cache read now has one bounded
deadline across enumeration/open/read, aborts its owned readonly transaction on timeout, and
closes late connections. It never clears account data or substitutes cache hints for native
authentication. The full test/type/lint results above include both startup fixes and the
subsequent worker-logging and mobile-theme corrections.

The merged frozen install used Node 24.14.1 / npm 11.11.0, with lifecycle scripts and npm audit
disabled. CI remains pinned to Node 24.18.1. A fresh feature-scoped dependency review is not
claimed. Historical whole-lockfile policies and findings below remain recorded, without
authorizing further core audits or turning inherited core findings into scoped blockers.

### September 7 verification hardening

Both exact reconciliation commits were subsequently tested sequentially with
`node --test --test-concurrency=1 --test-reporter=spec 'scripts/*.test.mjs'`:
PR1 passed 94/94 and PR2 passed 296/296, with no failures, skips or cancellations and native
exit 0. HEAD, tree and clean status were unchanged afterward. Saved summary and individual
logs: `postcommit-node-helpers-20260907-8d38a451833749408c13f7c72e5b76a2/summary.json`.
This post-commit rerun covers Node helpers only, not frontend Vitest, dependency audits,
hosted CI or later Candid follow-ups.

Actual generated-interface comparison then exposed declaration drift: shared Candid omitted
the existing Rust `ActionCard` message variants and records, while user-index Candid omitted
the private-match capability redemption method and the optional action recipient scope.
The corrections change only those two Candid files, not runtime Rust implementations.
The recipient variant preserves the actual serde wire labels, `confirmer` and `app_authorized`.

The new offline source-contract suite passes 38 tests: complete message-variant sets,
selected record fields/types and renamed states, plus method-name sets discovered from all
25 actual API directories. Controls reject duplicates, unsupported export forms, misleading
comments and an in-memory recreation of the missing user-index method. The initial shared
schema regression failed before its repair. Frontend CI used an explicit helper list; a
separate red-to-green routing regression now requires this suite in its executable policy
step, including for Rust/Candid-only changes. These checks are bounded source readers, not
full Rust/Candid parsers or proof of method signature/mode equivalence.

The final follow-up run passes all 336 offline Node helpers with no failures, skips or
cancellations; focused tests, the aggregate and scoped formatting each exit 0. All 207
recorded inputs, including the 25 Candid/Rust-main pairs, retain their hashes; HEAD and
dirty status are unchanged during the run. Evidence:
`candid-contracts-all-apis-final-20260907-c8d69fd637234e51816036356c7a0852/summary.json`
and its focused, aggregate and formatting logs. This is pre-commit follow-up source
validation, not a post-commit 336-test claim.

The subsequent complete generated-interface rerun also passes: all 25 interfaces regenerated
and all 50 strict comparisons succeeded, in both directions, with native exit 0 and a terminal
monitored child. All 2,879 recorded source inputs and the Cargo lock were unchanged. This
accepts the recorded working declaration fixes atop `cdceb9d127a329b49a82795662fadba77ab2f18f`,
not that earlier commit alone. Evidence:
`backend-candid-parity-runs/launch-fce066b6cd434a5d81dd22583dec9c56/summary.json`
and `run-475e62309c1b4d729e248875e99ba0bf/completion.json` beneath that launch directory.
The fresh reviewed APK's separate startup/asset acceptance follows. Interface parity does
not establish integration execution, hosted CI, physical-device or authenticated app-flow acceptance.

### Current Qwen local-test APK: September 9

The source-bound PR2 build produced `2.0.0-local-webgpu-qwen-20260909` with
OTA strategy `none`. All 5,974 recorded regular source files, four Git-link
identities and 15 builder inputs stayed unchanged; distribution validation passed
and the packaged worker matched the exact production-worker bytes used for the two-image
desktop checkpoint above. This byte identity is not broad image-accuracy qualification.
The byte-identical local handoff is
`<project-temp-root>/OpenChat-local-test-qwen-20260909.apk`, 78,629,642 bytes,
SHA-256 `5f2610f2fa27830e15c21b47b5b08b250b324f2989e032750fa3c0003efabe31`.
Build receipt:
`tmp/apk-responsive-source-identity-32ca3a5ac85045e7b553f93b482a9523/summary.json`,
SHA-256 `955aaac7fe0c63e0d7b5a732d8c10b5f7c09a5ec97cd25c2cea1705631ec4dce`.
Its immutable `installed:false` and `smoke_tested:false` fields describe build time.

A subsequent emulator cold-start passed at the expected onboarding screen, first
ready 4,293.3406 ms after launch. All 26 installed assets, the local origin
`http://tauri.localhost`, OTA-none policy, ORT import/WASM compilation and worker
disposal passed. Receipt:
`tmp/apk-welcome-smoke-65e32f68b51f4bcfbcf7c48e2220af72/smoke.json`,
SHA-256 `00184dff5c2cf828d302a1f8b102fbc8752aacf44b8fcaf886df32c77b6578bf`.
No model inference ran: APK GPU inference, account/model retention and physical-phone
acceptance remain unverified. The owned emulator then exited normally with status
`passed`, exit 0, terminal child and unchanged lock in
`tmp/responsive-apk-emulator-runs/run-ee04477033a74ade83e462ab07e09f0e/completion.json`.

The later retirement of the unused native-image helper/spec is source-only cleanup.
Neither file was an input in the qualified worker's observed module graph, and the
retained APK bytes are unchanged. The build receipt remains the exact historical
build identity, not an assertion that all current checkout files still match it.
The archive's `retirement.json` records the helper-only offline model-inventory change and
the then-pending reviewed-snapshot mismatch. The subsequent independent direct-feature
ownership review above resolves that mismatch without relabeling the historical receipt.
No publishing artifact or production deployment was made.

### Historical responsive local-test APK: September 8

The local all-WebGPU APK was successfully built from the source-bound dirty PR2 checkout at
`d7b94d8649951a5b7d4f46b7d216d41734dd4cf7`, with frontend version
`2.0.0-local-webgpu-responsive-20260908` and OTA strategy `none`. It includes the generic
cache-verification, stale-worker refresh and incremental-hash responsiveness fixes. All 5,958
recorded regular source files, four unfollowed Git-link identities and 14 builder/configuration
inputs stayed unchanged; the monitored build exited 0 and all 26 distribution assets passed.
Independent signer, native-library and Android-component verification also passed.

Artifact: `frontend/src-tauri/gen/android/app/build/outputs/apk/universal/release/openchat-release.apk`,
78,613,258 bytes, SHA-256
`f830b5e79e0c33aa14bf1a415f181ab6694fe67fedc30d9ac2adde0bdb72d0b5`.
Build receipt: `<project-temp-root>/tmp/apk-responsive-source-identity-40ca20f0f3ea4318aa9661f3e43e4bd7/summary.json`;
monitor: `tmp/local-apk-welcome-runs/run-5346f13dc6074a67a2fbaf8cd757cc26/completion.json`.
The immutable build receipt records `installed:false` and `smoke_tested:false` at build time.
Subsequently, on September 9 local time, the exact artifact was installed over the existing
`emulator-5554` app without uninstalling or clearing data. The byte-identical handoff is
`<project-temp-root>/OpenChat-local-test-responsive-20260908.apk`.
Its first cold-start probe failed during ADB attachment (`spawnSync adb.exe ETIMEDOUT`,
17,485 ms from launch), before a WebView snapshot or asset checks. That failed result remains
unchanged in `tmp/apk-welcome-smoke-152664d35de54d508bccecc74d1b19b5/smoke.json`.
After ADB recovered, a separate `inspect-existing` run observed the same app process and
expected onboarding screen at `http://tauri.localhost`; all 26 installed asset hashes, version,
OTA-none policy, ORT import/WASM compilation and worker-disposal checks passed. Evidence:
`inspection-smoke.json` and `inspection-onboarding.png` in that same run directory.
It explicitly records `coldStartAccepted:false`; later inspection does not repair the failed
cold-start measurement. No model download or inference ran, and account/cache retention,
physical-phone behavior and app-card acceptance remain unverified for this artifact.
The emulator was then gracefully stopped; its owned monitor records exit 0, terminal child
and unchanged lock at `tmp/responsive-apk-emulator-runs/run-c41498a82cf4401a97c116676d82efb8/completion.json`.
The physical-phone evidence above belongs to the retained September 7 APK.
No publishing artifact or production deployment was made.

### Reviewed local-test APK: September 7

`OpenChat-local-test-reviewed-20260907.apk` was built from clean PR2 commit
`e3d2cb91a426c67c6bcef0c5f664999e1676fb16`, with frontend version
`2.0.0-local-webgpu-reviewed-20260907`, the configured local signing identity,
all-WebGPU support and OTA strategy `none`. The 78,596,874-byte artifact has SHA-256
`2c1db086278e5e8308a5bb925d3de751464c63961caedcbaa01fffe81c31a55e`.
The monitored build exited 0; all 5,934 recorded regular source files, four unfollowed Git-link
identities and 11 builder/configuration/lock inputs were unchanged. Evidence:
`apk-reviewed-source-identity-c0c8876178b449aa8289fd4ddb6628d0/summary.json` and
`local-apk-welcome-runs/run-76e65b7fd74c4b5ba45a64531ff9a7a2/completion.json`.

The APK was installed over the existing app on `emulator-5554` without uninstalling or
clearing app data. Onboarding was first observed ready
3.37 seconds after the cold launch and remained ready through the asset checks. All 26
installed runtime assets matched their distribution hashes; the pinned ORT module imported,
its WASM compiled and the actual worker acknowledged disposal. The packaged origin was
`http://tauri.localhost`, with the expected version and OTA-none policy. The screenshot
showed the expected onboarding controls. Evidence:
`apk-welcome-smoke-485363da6bd74e7b9df0fa348ce23657/summary.json`, `smoke.json` and
`onboarding.png`. This does not prove retained authentication/model caches, wallet sign-in,
physical-device GPU inference or complete app-authored card flows; no model inference ran.

The build retains Sass, SDK and Gradle warnings. Its Porto/Tempo unresolved-dependency
warnings were traced to unused connector code: a read-only parse of all 186 top-level emitted
JavaScript files found no static or literal dynamic bare imports. That review is not wallet
authentication acceptance or a new automated bundle regression. No release was published.

This reviewed September 7 APK remains the retained physical-phone artifact. The exact source diff from
`e3d2cb91a426c67c6bcef0c5f664999e1676fb16` to current PR2 `d7b94d8649951a5b7d4f46b7d216d41734dd4cf7`
contains only six documentation, security-policy and test paths, with no app payload changes.
No APK rebuild is required solely for that head change. Its build source remains `e3d2cb91a`;
do not relabel it as a build from `d7b94d864` or infer phone acceptance from emulator asset checks.
The subsequent September 8 runtime responsiveness changes are included in the newly built
local-test APK above; the old artifact does not contain them. Cold-start, physical-phone and
model-flow qualification of the new artifact remain pending despite its later emulator inspection.

### Other verification hardening

The store-AAB verifier now checks the base-manifest package, version name and version code
independently of its existing signature checks. Its standalone bundletool 1.18.1 is pinned
to 32,505,571 bytes and SHA-256
`675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c` before execution.
That hash is locally measured official-download evidence, not an upstream-published checksum.
The offline release selection passes 103 tests
(`node --test scripts/android_release_policy.test.mjs scripts/android_release_checks.test.mjs scripts/release_preflight.test.mjs`;
locally observed terminal output). Separately, the actual pinned tool passes 11 synthetic
aapt2-compiled manifest cases, including wrong/missing/padded identity attributes,
namespace/duplicate lookalikes, malformed bundles and a modified tool. Evidence:
`aab-manifest-real-tool-tfZsvO/summary.json`. These fixtures do not accept a production
bundle, publisher signing, installation or upload.

Both frontend entries now render anonymous-home onboarding without waiting for chat
registry discovery, while leaving authenticated, public-route and chat/card readiness
requirements intact. Query-driven Home navigation retains ownership of its modal state.
Mounted regressions exercise both actual entry components, including late readiness and
authentication buttons that stop event propagation; capture-phase activity tracking preserves
an in-progress v1 form. A fresh independent PR1 run passes all 123 files / 1,488 tests,
Svelte with 0 errors / 558 warnings, agent TypeScript, read-only ESLint with 0 errors /
30 warnings and all 94 Node helper tests; no tests were skipped. Its 37 dirty files matched
the independent review inventory before execution. All 46 recorded source/lock/configuration
inputs and the dirty path/status set were unchanged afterward. This refresh confirms the
same counts, not an additional test population. Evidence:
`pr1-frontend-validation-20260907-auth-display/summary.json` with its stage logs and
`vitest-results.json`; before/after snapshot SHA-256 is
`97da970c1a964d64b693b99658c006aacdacc7a03a7c4587c0132a8d8e7acb69`.

PR2's earlier
188-file / 2,535-test startup rerun included the final test-only loader mocks. Nineteen selected
startup/authentication/configuration source hashes were unchanged during those runs. That
frontend count is superseded by the post-review 190-file / 2,550-test run below.

Post-review regression tests caught two more merge interactions. The worker now preserves
the shared logger's primary-error and expected-error-filtering contract while passing only a
new bounded, redacted error to telemetry. It does not log request payloads, original messages,
stacks, causes or arbitrary error names, and correlated errors returned to callers are unchanged.
Six of seven real-worker/shared-logger cases failed before the correction; all seven then
passed within a 33-test worker/error selection. No live telemetry was used.

Mobile AI status and spinner surfaces also retained theme variables removed upstream.
Only generic theme-token references were corrected, including the companion suggestion chip;
inference, routing and app interpretation are unchanged. Eight dark/light regressions failed
before the fix and pass afterward: they compile the actual component styles and mount the
real shared spinner with prop values read from its callers. Together with existing composer,
card-layout and selected-message flow tests, the focused selection passes 29 tests. This is
not a full chat mount or a device visual/inference acceptance run. PR1's corresponding
components have no affected token references, and the PR2-only chip was not copied into PR1.

The final sequential PR2 validation passes 190 frontend files / 2,550 tests, Svelte with
0 errors / 562 warnings, agent TypeScript and read-only ESLint with 0 errors / 31 warnings.
Targeted formatting also passes. All 62 recorded source/lock inputs retained their hashes
through the run; this is a bounded working-tree snapshot, not a commit-wide artifact attestation.
Evidence: `pr2-frontend-validation-20260907-cf114059659944cf8bd4db45b0016619/summary.json`
with its `vitest-results.json` and stage logs; `pr2-resolution-review-SKfjgo/worker-logging-red-behavior.json`
and `worker-logging-green.json`; and `pr2-mobile-ai-theme-red-20260907.log` /
`pr2-mobile-ai-theme-green-20260907.log`. These fixes postdate the welcome APK below.

Native onboarding error rendering now maps known raw authentication codes to existing
translations and uses the generic translation for legacy/unknown codes. Authentication
handlers and recovery routing are unchanged. Regression tests execute the actual template's
display expression and mount the real translation component with English and Arabic
catalogs; they do not mount the complete authentication modal or exercise device providers.
These source tests alone do not establish APK startup or sign-in acceptance. Separate
September 7 installed-APK startup evidence is recorded below; sign-in remains unverified.

Both model workflows now have a separate Android component-contract job with nine
byte-size/SHA-256-pinned Kotlin/JUnit tool artifacts. The actual cached artifacts were
checked against that manifest, then used separately on both trees for 12 host tests,
7 real-SDK constant checks and production-source compilation against Android 36.
The resolver/CI-coverage subset passes 40 tests per tree. All six native Cargo test/check
commands retain their platform, feature and real-fixture selections and now require
`--locked`; a regression rejects either an unlocked or unaccounted-for native command.
None of these host checks proves Android authentication, cache retention or GPU inference.

The backend PR change-detection job now explicitly requests only `contents: read` and
`pull-requests: read`, as required by its PR-files filter. The permission regression failed
before the fix. The rollout wiring validator also previously accepted numeric prefixes:
expected app ID 1 matched 12, and signature version 4 matched 40. It now validates the
structured output of `dfx --query --output json`, including exact IDs, relay/route,
authorized depositor and signing-key metadata. Its 48 real-shell regressions run in the
hosted frontend policy step; separate coverage tests reject a suite mentioned only in a
comment or another step. No live canister response or independently pinned consumer key
was verified by those fixtures. Official DFX JSON mappings and repository types were
reviewed, but exact pinned-version response serialization was not dynamically reproduced.

The actual unchanged Candid syntax script passed all 25 interfaces with exact CI `didc`
0.3.2 in explicit Ubuntu, after an earlier cached-0.4.0 run. The script and all 25 inputs
retained their hashes. The legacy official release provides no publisher checksum;
the download's official release URL/size, executable version and local SHA-256 are recorded,
not described as independently signed provenance. This is exact-tool local syntax evidence,
not hosted CI or Rust/Candid parity. The parity checker has real-shell failure-propagation
and temporary-file-cleanup tests. At that earlier stage, its actual generated-interface
comparison was outstanding; the completed full rerun is recorded above. Matching Rust 1.95 Linux
offline metadata resolution stops before compilation because locked `h2` 0.4.16 is absent
from that cache. The earlier full Windows backend gate stopped in OpenSSL configuration
because Cygwin Perl does not satisfy the MSVC target. The project-local native Perl retry
successfully compiled OpenSSL's MSVC libraries and progressed through notification
dependencies. That exact workspace run was then terminated for disk safety before any
unit test ran; it is an aborted gate, not a passing result or a source-test failure.
That first disk-aborted run changed no profile, package exclusion or lockfile.
A subsequent exact-scope retry exposed a real reconciliation compile error: ActionInbox
still called the removed `utils::git` API. It now uses the existing workspace-local
`git_commit_id` crate, as the upstream canisters do. The manifest and lock change add
only that local dependency edge; no external package version, source or checksum changes.
Locked offline metadata, workspace formatting and the helper regressions pass. The next
monitored retry compiled ActionInbox successfully but again stopped at the disk-safety
threshold before any unit test ran. This remains an aborted full gate, not a pass.
The current Cargo lock SHA-256 is
`dd165eddd49d39daebdbbe80aa78199845b8cb3d3ca42d4ce89d131e3b97116b`.
Generated-artifact compression preserves file contents; no backend profile or package
exclusion has been relaxed to make the gate fit.

The subsequent full-scope retry reached a verifier test-compilation error: a fixture
converted `UserId` back into `Principal` through a removed upstream API. The fixture now
supplies the identical principal directly, with no production encoding change. All five
`ai_app_verifier_canister` tests pass, including the fixed canonical commitment hash and
recipient-scope compatibility assertions. That full workspace attempt failed before tests;
the focused five-test result did not replace it. Evidence:
`run-7dfa9edc63cc48fe9df287a10668f5c0/completion.json` and
`pr2-verifier-fixture-green-20260907.log`.

A later exact-scope retry exposed a stale source assertion for the upstream typed C2C
error accessor. The test now accepts formatting changes but retains an exact redacted-log
field allowlist. After that test correction, the complete backend unit command passed:
`cargo test --locked --offline --workspace --exclude integration_tests --exclude open-chat --exclude tauri-plugin-oc`.
The result is 957 passed, 0 failed and 1 existing ignored `print_interop_vector` test; the
monitored process exited 0 and the Cargo lock hash above was unchanged. This supersedes
the earlier aborted/failed unit attempts without relaxing their package scope or profile.
Evidence: `backend-unit-runs/run-f4b0d6a9c33747b4b6ee2e23b49858f7/completion.json` and
its `stdout.log` / `stderr.log`. Full backend unit success does not establish integration-test,
hosted CI, backend rollout or device acceptance. Candid parity was accepted separately above;
the remaining runtime and hosted requirements are not inferred from the unit result.

Full backend strict Clippy now also passes the exact local command
`cargo clippy --locked --offline --keep-going --workspace --exclude open-chat --exclude tauri-plugin-oc --tests -- -D warnings`.
This includes compilation of `integration_tests` targets, not their execution. The monitored
run exited 0 with warnings treated as errors; the recorded manifest, lock, backend-workflow and
monitor hashes were unchanged. Minimum observed free space was 8,358,588,416 bytes, with
the existing disk thresholds unchanged. Evidence:
`backend-clippy-runs/launch-1b806ddff30e473fae987a5241dda4bb/run-fbbac4b6573940f5a52a03b5fde0f67e/completion.json`,
its logs and the launch directory's `preflight.json` / `source-after.json`.
Only process-local native-tooling setup was corrected: the MSVC environment and canonical
`Path` key restore nested compiler lookup. A controlled native probe reproduced the uppercase
`PATH` failure and `Path` success (`clippy-path-casing-probe-20260907-7495c9d2/controls.json`
and `wrapper-regression.json`). No source gate, package scope, profile or warning policy was
weakened. Full generated-interface Candid parity subsequently passed as recorded above;
hosted CI, integration execution and physical-device acceptance remain separate gates. The
reviewed local APK above supersedes the earlier pending rebuild; its runtime limits still apply.

The backend integration wrapper now also requires `cargo test --locked`, preserving its
existing package, filter, thread-count and failure behavior. Its source-command regression
failed before the change and passes afterward in the hosted policy suite. This is a
reproducibility check, not an actual integration run: the wrapper's download/setup and
canister lifecycle tests have not been accepted from these fixtures.

Local evidence: `openchat-pr2-offline-policy-final-20260907.log`,
`openchat-pr1-offline-policy-current-20260907.log`,
`pr1-real-cached-contracts-20260907-005553.log`,
`pr2-real-cached-contracts-20260907-005553.log`,
`openchat-pr2-ubuntu-candid-syntax-20260907.log` and
`openchat-pr2-ubuntu-offline-metadata-20260907.log`. The exact-tool syntax rerun is
`pr2-didc-0.3.2-syntax-20260907-015942-021.log`; the aborted Windows run is
`openchat-pr2-native-perl-backend-workspace-unit-20260907.log`.

### Historical September 7 welcome APK: superseded by the reviewed APK

**This APK predates the final worker-logging and mobile-theme fixes above.** Its three
cold-start passes remain valid for this exact artifact, but it is not the final current-source
APK. The reviewed September 7 APK above subsequently completed that rebuild and its separate
bundled-asset/startup checks; keep this older artifact's results historical.

The monitored local build completed with exit 0 using the unchanged locked dependencies,
the configured existing local signer, application ID `com.oc.app`, version code `1000`
and upstream code namespace `com.oclabs.openchat`. Binary checks verified the signer,
manifest/DEX component classes, FileProvider authority and embedded ARM64 native library.
The 78,596,874-byte handoff APK has SHA-256
`de78547f9f7dd3612a5178423547561814544401d0feacf4f5a79d49750f5659`.
It contains frontend version `2.0.0-local-webgpu-welcome-20260907` with OTA strategy `none`.
At build time, this artifact used the then-uncommitted merge and follow-up changes, not a
published PR head or either merge parent alone. It is not current-source acceptance.
The September 6 rollback APK is preserved.

An install-over on the existing emulator package succeeded without uninstalling or clearing
app data. Three separately timed cold launches then passed the strict 30-second startup
gate. The v2 onboarding controls were first observed ready at 3.462, 2.255 and 2.473 seconds
from the respective host launch timestamps, and remained ready for at least 300 ms and
through the final observation. The latter two launches did not reinstall the APK. Every
run verified all 26 installed asset hashes/sizes, exact frontend version, disabled OTA,
ORT factory import, WASM compilation and a disposable worker roundtrip. The rendered
welcome screenshot was visually checked. No navigation/reload or late existing-state
inspection was substituted for cold-start acceptance.

These results establish this artifact's local packaging and anonymous welcome startup only.
They do not establish signed-in account/model retention, passkey provider behavior,
authenticated app-card flows or physical-device GPU inference. No model was downloaded
or executed by these smoke tests, and prior emulator DNS/GPU findings are historical,
not a fresh capability check of this APK.

The build launcher required process-local host corrections: canonical Windows `Path`
key casing, the already-cached repository-pinned DFX version, and excluding only its WSL
executable variable from Git Bash environment-path conversion. Controlled probes reproduced
the launcher failures before correction. No system default, public-key/version guard,
dependency lock or application feature was relaxed to obtain the build.

Local evidence: build run `run-d7ca54f6c78c4b96a2eadaa4afe58a20/completion.json`,
`apk-welcome-smoke-0a23c1ed0e07455b84b9b91ef5906bc8/summary.json` and `smoke.json`,
and repeated cold-start reports under `apk-welcome-cold-repeat-5f1b1bb109b44f24ae31d9d1f40e6be5`
and `apk-welcome-cold-repeat-d780748aa06c4f90bf5187aad5a3894a`.

### Historical September 6 local-test APK: merged source

**Artifact predates the latest source fixes.** Its identity/assets remain recorded evidence,
and is superseded by the reviewed September 7 APK above, not reused to claim its behavior.

The configured local builder completed with exit 0 and produced a 78,596,874-byte APK,
SHA-256 `c63fead2d577892bb4ff4e71da373c33f54cc39510d9e04eb9873e8a74f9ac56`.
Binary verification passed for installed application ID `com.oc.app`, version code `1000`,
and the existing configured local certificate. The code namespace remains
`com.oclabs.openchat`; the local profile does not rename upstream classes or change the
publisher's identity. The frontend version is `2.0.0-local-webgpu-merged-20260906`, with
OTA policy `none`. Source attribution is the dirty `6be70333` + `2a95a68` merge above,
not a published PR head or either parent commit alone.

This was the local artifact at that time, replacing the earlier `551265bbe` APK as the test
candidate. Its identity report was captured before installation. The subsequent install-over
on the existing emulator package succeeded without uninstalling or clearing app data, and
the activity launch reported `Status: ok` in 11,789 ms. Neither result proves account reuse,
model-cache retention or UI readiness. The initial strict 30-second readiness probe failed
at its attach-stage body snapshot (4,000 ms timeout, 24,972 ms elapsed from launch); its 26
installed-asset checks were **not run**. Mobile startup is not accepted from this result;
the corrected probe subsequently gave UI observation the full remaining 30-second budget
and **also failed**. Its activity launch took 6,804 ms; at 29,933 ms from launch there was
no visible main UI, no button and no error pane. Observation timed out at 30,012 ms, and
the inspected screenshot still showed the spinner. This retry did not run asset checks.

A separate read-only `inspect-existing` run passed all 26 installed-asset hash checks,
confirmed the exact new frontend version and OTA policy, imported the ORT factory, compiled
its WASM and disposed its disposable worker. The expected v2 welcome screen was also
observed and visually checked. That report deliberately records `inspectionPassed:true`
but `passed:false` and `coldStartAccepted:false`: inspecting an already-running app cannot
accept cold startup. An earlier post-start observation showed eventual welcome rendering
at 194,417 ms of navigation time; eventual rendering does not repair the failed deadline.

That APK's diagnostics independently showed that its configured private backend failed with
`net::ERR_NAME_NOT_RESOLVED`; no network configuration was changed. This proves backend
unreachability in the emulator, not that DNS alone explains the startup delay. Its WebView
151.0.7922.199 exposes `navigator.gpu`, but both default and high-performance adapter requests
return null. No model was loaded or inference performed. No fatal native/Java failure was
observed in the inspected logs, which did contain emulator graphics warnings. The current
emulator at that time provided neither startup acceptance nor all-WebGPU inference evidence;
physical-phone, account/model-retention and authenticated app-card checks remain outstanding.

Two build-environment repairs preceded the successful build. A shared Tauri package cache
from the prior namespace omitted the generated activity and ProGuard output. Only that
scoped package cache was refreshed (29.8 MiB); the vendor generator then emitted both files,
without copying generated app code from another checkout or namespace. The previous APK
and native library were preserved. Process-only `kotlin.incremental=false` avoided the
cross-drive incremental-cache exception; no global compiler default was changed.

Local evidence is recorded in `openchat-local-apk-merged-identity-20260906.json`,
`openchat-local-apk-upstream-build-generated-cache-fixed-20260906.log`, and
`openchat-local-apk-merged-readiness-20260906.json`. The final strict retry is
`openchat-local-apk-merged-cold-retry1-20260906.json`; separate inspection, backend and GPU
records are `openchat-local-apk-merged-existing-inspection-20260906.json`,
`openchat-local-apk-merged-backend-probe-20260906.json` and
`openchat-local-apk-merged-webgpu-capability-20260906.log`. Binary checks, install/launch,
strict startup, existing-state asset inspection, physical GPU inference and authenticated
app-card flows remain separate results. This artifact is not published or publisher-signed;
publisher-only signing, version and upload requirements do not block the requested local test.
The historical security-policy failures remain recorded; the current feature-only review
boundary above governs further work, not a request for a broad core audit.

### Historical post-startup-fix production bundles

Both production frontend variants were rebuilt after the two startup fixes above, using the
same dirty merged working tree and existing frozen dependencies. Fourteen recorded source
fingerprints, including both startup-fix files, were unchanged during each build and identical
between builds. The results include uncommitted merge bytes, not just either parent commit.
The frontend lock SHA-256 remained
`8315c6237eac3758e25e6c3428e11c917fbfb1da56ecab57f8fd93eb59f92507`.

| Final frontend configuration        | Build result     | Preserved files / bytes | Model worker and ORT JSPI |
| ----------------------------------- | ---------------- | ----------------------- | ------------------------- |
| Default production                  | Exit 0; 2m 35.7s | 933 / 118,043,376       | Absent as expected        |
| Explicit immutable WebGPU candidate | Exit 0; 2m 35.3s | 949 / 169,102,826       | Present and verified      |

The ordinary worker (1,337,869 bytes), video worker (625,789 bytes), and candidate-only model
worker (894,466 bytes) match their freshly compiled outputs exactly. Both default ZIPs contain
574 files and both candidate ZIPs contain 596; all four preserve their expected worker bytes.
The [distribution verifier](../../scripts/verify_webgpu_distribution.mjs) passed all 26 assets,
including 21 notices/sidecars, in the candidate directory and independently in both candidate
ZIP entry streams. Neither final output has a separate `StartupFailure` chunk or dynamic
recovery-component import; the recovery component is included in the main bundle.

The Windows build used Node 24.14.1 and the explicitly selected cached dfx 0.31.0-beta.1,
retaining the exact version guard and real anonymous public-key query. Build-only tool values
did not leak into artifacts. The candidate used only process-local
`OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE=true` and
`OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY=immutable-hub-v1`; production defaults and app-card
capability gates remain unchanged. No dependency installation, fresh audit or inventory upload
was part of this validation.

These builds were **not warning-free**. Default production logged 581 TS6054 unsupported
`.svelte` extension diagnostics; the candidate, run after parallel typechecks ended, logged
none. Causation is unproven and no compiler workaround was applied. Svelte, Sass, CSS URL,
source-map, circular-dependency and optional-wallet warnings remain. Separate passing
typecheck results above are not a claim that Rollup emitted no diagnostics.

Local validation records are `openchat-pr2-merged-production-final-summary-20260906.json`
and `openchat-pr2-merged-production-build-review-20260906.md`; final per-mode artifacts and
reports carry the `post-startup-fix-20260906` suffix. Earlier outputs without that suffix are
pre-fix evidence only. These are frontend packaging results with `inferenceVerified:false`,
not a refreshed APK, Android component execution, account reuse, passkey, app-card or
physical-device all-WebGPU acceptance result. Separate local-test APK evidence appears above
and does not require the publisher-only signing/version/upload prerequisites below.

After these frontend bundle runs, Android's build-only optional-defaults loader was corrected
for fresh checkouts. A missing optional `.env` file is accepted; an existing malformed,
nonregular or unreadable file fails. Caller-supplied outer values retain precedence over file
defaults. Five real-shell regressions increased the offline policy/helper aggregate from 193
to 198 passing tests; the 2,450-test frontend result is unchanged. The actual local-test APK
result is recorded above, not inferred from these shell tests or frontend bundle results.

## Published source and submission state

The PR heads in the table were rechecked on September 9 and remain unchanged. The checkpoint,
upstream-comparison and commit-distance details in this section are historical, not a new
comparison of today's reconciled heads against upstream.

The published integration checkpoint is `2029f00d726ca7c33de22c53c24cf1ada173d3fb`
on `codex/pr2-clean-integration`, tagged `model-integration-checkpoint-2026-09-05`.
The lint cleanup, compatible dependency updates, portable security hashes, CI coverage,
Android release safeguards and this preparation package follow that immutable checkpoint.
Use the preparation commit SHA for further validation; never move the checkpoint tag.
The earlier local-test APK source was `551265bbeff8191ed36d0446bc8ef1d54edf74f8`.
It included the generic voice, runtime-settings and worker-rebuild follow-ups and superseded
the `e02bd70d4` artifact at that time. It is now historical, not the current merged-source
candidate. Its cold startup was not accepted because emulator private-network DNS was not
configured for its backend; that historical result is retained below.

| Submission                                                                 | Observed head                                | Base                           | State                         |
| -------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------ | ----------------------------- |
| [Upstream PR #9132](https://github.com/open-chat-labs/open-chat/pull/9132) | `codex/pr1-local-models`, `045f7132e`        | upstream `master`              | Draft; no reported check runs |
| [Fork PR #73](https://github.com/ktimam/open-chat/pull/73)                 | `codex/pr2-app-chat-interfaces`, `c7299aa11` | `codex/pr1-local-models`       | Draft; no reported check runs |
| Historical APK preparation source                                          | `codex/pr2-clean-integration`, `551265bbe`   | descends from both heads above | Not either PR's current head  |

The integration checkpoint is 16 commits / 115 changed files beyond PR #73's head.
Those commits mix later model-runtime fixes and app-interface fixes. It is 60 commits beyond
PR #9132's head. Do not present this checkpoint as a PR2-only refresh without separating scope.
Upstream `master` was rechecked at `df9d9ed52db00e87fbb7309280a325902c9bb2cc`:
the checkpoint and upstream have 98 and 126 unique commits respectively. Since the first
assessment, upstream added Play signing-key association and legacy-install migration notices.
Its Android package-identity migration must be reviewed explicitly when reconciling the stack;
do not uninstall or change the existing local-test package/account identity as a merge side effect.
The checkpoint itself does not contain the newly validated local conflict resolutions above.

## Preserve the two-PR structure

The latest bounded source-boundary review checked 5,336 tracked PR2 text files and
4,936 tracked PR1 text files, plus 18 additional PR1 source files. It found no prohibited
app contracts, field-role assumptions or private machine identifiers; the existing PR2
boundary audit also passed across its separate 5,276-file scope. Manual inspection of
candidate matches confirmed that financial/image-label fixtures exercise caller-supplied
schema, caption and keyword inputs rather than host-owned business rules. This is a
bounded scan and surface review, not proof of semantic absence in every repository path.

The Android build-generated source review found no machine/cache paths in 65 tracked
Android and plugin-permission text files. The apparent manifest/Gradle/permission drift
was line-ending or regeneration metadata; schema coverage matches the incoming PR1
source for all 31 commands. Only the local Kotlin build cache was newly ignored, without
deleting diagnostics or ignoring application source.

1. Refresh PR1 with generic model catalog/runtime, installation/cache, optional audio,
   native bridge, model settings and their tests. Keep third-party app structures out.
2. Refresh PR2 on the resulting PR1 head with manifests, registered processing surfaces,
   cards, scoped linking/private context, attestation, confirmation and inbox delivery.
3. Review mixed files such as inference routing, message menus, startup and native identity
   by hunk and dependency. Do not blindly cherry-pick all 16 integration commits into either PR.
4. Validate each resulting head independently, then validate the combined stack. Retarget
   PR2 to upstream `master` only after PR1 integration is agreed with maintainers.
5. Update existing PR descriptions rather than create duplicate submissions. Prepared bodies:
   [PR1](pr1-local-models.md) and [PR2](pr2-app-interfaces.md).

The [stack refresh plan](pr-stack-refresh-plan.md) identifies the reviewed scope split and
append-only inheritance. PR1's generic follow-ups and PR2's reconciliation are committed
locally; the declaration/contract follow-ups were validated before commit as changes atop PR2.
Neither published PR head has changed. Feature-scoped dependency review, final-head hosted
checks and runtime acceptance remain separate requirements; unrelated core remediation is
outside the requested scope.

This is a proposed publishing sequence, not an executed history rewrite. Keep the checkpoint
tag available for comparison; do not move it to a rebased or lint-cleaned head.

## Historical integration verification (before upstream reconciliation)

Results below use isolated integration source plus the current fixes and exact updated
frontend lockfile, not refreshed PR1/PR2 heads. The production web build was run; no signed
shipping APK was built or accepted.

The historical `551265bbe` local-test ARM64 APK was built and installed over the emulator's existing
package without uninstalling or clearing data. It is 84,773,670 bytes, SHA-256
`04c1579baf8f3d5012388863bc7280b455cbaf31af6746993937ede5e44c4bf5`, with the existing
local Android debug certificate and `com.oc.app` identity (native version `0.1.0`, code `1000`).
That APK served frontend version `2.0.0-local-webgpu-551265bbe-20260906` and OTA policy
`none`. Its 26 served runtime/graph/notice assets match the built hashes; the actual WebView
imports ORT, compiles the pinned WASM and receives acknowledgement from its packaged worker.
The v2 welcome screen eventually renders. The initial startup-only probe captured the spinner;
a controlled cold restart then exceeded the 30-second WebView readiness limit. The later
rendered screen is not a passing cold-start result. Diagnosis found that the emulator cannot
resolve the configured private backend (`net::ERR_NAME_NOT_RESOLVED`), while the host reaches
the same status endpoint successfully. Bundled UI loads in 2.9 seconds; an existing registry
retry/gating path delays onboarding until 50.7 seconds. This behavior predates the model
changes in both PR1 and current upstream. No model assets load during startup. Emulator DNS
and private-network routing need validation before repeating the unchanged readiness check;
no APK-origin, account, guest-file or network-settings workaround was applied.
The emulator is at sign-in and exposes no WebGPU adapter, so authenticated model settings,
account linking, image/voice inference and model proposals were not verified. This artifact
is not publisher-signed and was not uploaded. The configured builder's known Gradle fallback
ran only after a freshly compiled ARM64 library; build and fresh-artifact checks passed.

| Check                                                                                       | Result                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full frontend unit tests, current integration follow-up                                     | 133 files / 1,862 passed with four workers; zero skipped tests                                                                                                                               |
| Svelte typecheck, current integration follow-up                                             | 0 errors; 546 warnings in 195 files                                                                                                                                                          |
| Agent TypeScript check                                                                      | Passed                                                                                                                                                                                       |
| Read-only ESLint                                                                            | 0 errors; 31 existing warnings (26 errors corrected)                                                                                                                                         |
| Frozen isolated dependency install                                                          | Passed; model/ONNX/OCR runtime lock entries unchanged                                                                                                                                        |
| Release/CI/digest/format/preflight/archive/notice tests                                     | 147 passed, zero skipped                                                                                                                                                                     |
| Current frontend CI policy test command, including SBOM lock identity and model CI coverage | 134 passed, zero skipped; narrower command than the historical aggregate above                                                                                                               |
| Production WebGPU candidate build                                                           | Passed in 2m55.5s with the final frozen dependency tree, explicit immutable-delivery contract and real public-key query; both store/full OTA ZIPs produced                                   |
| Built WebGPU payload                                                                        | 26 exact assets verified: worker, ORT pair, two Qwen graphs and 21 notices/sidecars; this is packaging evidence, not inference                                                               |
| Built module browser smoke                                                                  | Chrome 152.0.7977.76 imports actual ORT JS, compiles pinned WASM and receives disposal acknowledgement from the compiled worker under the built CSP; no model inference or full-app UI claim |
| Immutable download endpoints                                                                | 52/52 public HEAD checks passed: 26 unbundled base/audio files × web/APK origins, expected lengths and CORS headers; no body-hash or browser-enforcement claim                               |
| Actual OTA ZIP round trip                                                                   | 3 tests passed on Windows; corrected UTF-8 archive also extracted with Android's actual `zip@2.4.2` dependency, preserving six files' exact names and bytes                                  |
| Diff whitespace check                                                                       | Passed                                                                                                                                                                                       |
| App/host boundary audit                                                                     | 5,145 text files / no findings; rerun after any scope split                                                                                                                                  |
| Hosted checks on existing PRs                                                               | None reported; not a pass                                                                                                                                                                    |
| Affected backend Rust packages                                                              | 57 tests passed, 1 existing ignored test; strict Clippy and workspace formatting passed                                                                                                      |
| Nine affected backend library targets, current integration follow-up                        | 590 tests passed, none ignored; combined strict Clippy passed for library and test targets                                                                                                   |
| Native model-manager follow-up                                                              | 23 tests passed, none ignored; default-feature strict Clippy passed for library and test targets                                                                                             |
| Hosted native model checks on `753d2cecc`                                                   | Linux and Windows hermetic tests and both feature builds passed; separate pinned native CPU model inference passed                                                                           |
| Signed shipping APK / production rollout                                                    | Not built or performed                                                                                                                                                                       |

### Latest completed hosted checks: exact `769689f4f`

- [Frontend](https://github.com/ktimam/open-chat/actions/runs/34039358129): the complete
  frontend pipeline and candidate packaging build passed, including the previous lint repair.
- [Model checks](https://github.com/ktimam/open-chat/actions/runs/34039358119): frontend model
  contracts, Windows/Linux native tests and feature builds, and actual inference with the
  pinned 14 MB native CPU fixture passed. That CPU fixture is not phone WebGPU proof.
  The earlier `551265bbe` frontend-model job did not run its tests because the ONNX Node
  installer download failed (`ETIMEDOUT` / `ENETUNREACH`); the new run verifies those same
  source tests successfully. The dependency job checked 291 formatted
  files without a formatting error, then failed the expired baseline and reviewed dependency
  drift. Its later Rust/license/SBOM steps were skipped; no security allowance was raised.
- [Backend](https://github.com/ktimam/open-chat/actions/runs/34039358377): full unit tests
  and formatting passed. The verifier fixture's two needless borrows no longer fail. Strict
  Clippy progressed to one further test-module ordering finding in `principal_to_user_id_map`.
  Its test module is now moved after the unchanged default implementation; the authorization
  generation test, scoped strict Clippy and workspace formatting pass locally. The follow-up
  still needs the complete hosted workspace Clippy run. Backend CI now preserves the exact
  lockfile and uses `--keep-going` to collect independent lint errors in one run, while retaining
  fatal warnings and the same test scope. A red-to-green policy regression guards those options.
- [App security](https://github.com/ktimam/open-chat/actions/runs/34039358128): review expiry,
  reviewed dependency drift and advisory policy still fail. Fresh npm audits for the current
  integration lock reported two moderate findings and no high/critical findings in both scopes;
  the moderate count exceeds the old policy's one-finding allowance. No allowance was raised.

Local backend follow-up repairs the duplicate permission arm, adds exhaustive provenance and
role tests, applies narrow documented lint expectations to existing public API representations,
and boxes only three private prepared-deposit payloads. The affected chat-events, group-chat,
group, community and user targets pass 146 tests and focused strict Clippy. A further mechanical
inbox cleanup preserves cursor iteration and replaces test-only temporary vectors; its 60
tests pass, bringing the first focused total to 206. Subsequent user-index, group-index and
local-user-index repairs bring the combined nine-target total to 590 passing tests and strict
Clippy. These changes retain stored structures and public wire payloads; only transient lookup
results are boxed, with value, persistence and expiry-boundary regressions. The historical full
Windows workspace Clippy attempt stopped at the local Cygwin-Perl/MSVC OpenSSL incompatibility.
The September 7 full locked/offline pass above supersedes that local blocker, not the need
for full hosted Linux CI. Card-authorization requirements
are unchanged by these repair batches.

The development model-worker watcher now includes its full generic helper list. A helper edit
rebuilds the worker and rotates its runtime version only after success; generated output is not
watched. The sequential-session transform is imported afresh on each attempt, including retries
after build or syntax failures. Tests exercise the real transpiled Vite plugin with controlled
build/watch fixtures. This closes a stale-development-worker path, not a phone GPU acceptance gate.

The dedicated model workflow previously selected only eight named test files and did not trigger
for many worker/runtime edits. It now selects model test families and relevant source/build/notice
paths. A regression inventories the actual test files and verifies both workflow selection and
Vitest discovery. This also exposed an existing WASM packaging suite excluded by the root Vitest
configuration; that suite is now included. The exact expanded model command passes 29 suites /
418 tests. Full frontend CI was already broader; neither suite is physical-device inference proof.

The subsequent generic voice closure now exercises both composers and the real media-reader /
storage transport path. Public downloads retain image-only defaults (5 MiB / four queries)
and require explicit audio selection (10 MiB / seven queries). The public actor is anonymous,
does not retry, and shares a 12-second deadline through headers and body consumption. An
independent review reproduced a stalled-body escape from the original timer; the corrected
helper now aborts and cancels that stream, with a red-to-green regression. Early reader
rejections also abort unread bodies. These bounds do not prove that arbitrary containers
decode successfully or that a model transcribes them accurately.

Mounted runtime-settings tests prevent stale optional-audio completion from updating a new
model or a destroyed component. Generic `/ai` tests cover both UI handlers, staged/replied
media, exact account/chat/thread capture and duplicate-run guards. Unsupported audio is
rejected before legacy browser/native text-only inference. The full frontend result above
includes these changes; no CPU/provider fallback or app-specific extraction was introduced.

### Earlier build failures and their repairs

Hosted checks on `808a75d3e` exposed failures that unit tests did not cover:

- [Frontend run](https://github.com/ktimam/open-chat/actions/runs/33994920416):
  unit, type and lint checks passed; the production bundle failed because `dfx` was absent.
  Both frontend and Android CI now install the repository-pinned `dfx` version using the
  immutable official setup action. The real public-key query is retained, not replaced with a fixture.
- [Backend run](https://github.com/ktimam/open-chat/actions/runs/33994920435):
  fixed formatting, an equivalent derived `Default`, and deprecated fixed-array conversions.
  The affected packages passed local strict tests; the subsequent complete hosted run exposed
  the additional backend failures recorded above.
- [Model security run](https://github.com/ktimam/open-chat/actions/runs/33994920417)
  and [app security run](https://github.com/ktimam/open-chat/actions/runs/33994920407):
  security expiry/drift remains a failure. Separately, all 82 source formatting failures were
  corrected with exact Prettier output; all 284 policy candidates including manifests now pass.
  The checker invokes installed Prettier directly in bounded batches so Windows' shell command
  length limit cannot prevent checking large candidate sets. Every batch failure remains fatal.

The local Windows production build passed the real public-key query and Rollup type declarations,
then exposed a missing `zip` executable at OTA packaging. Packaging now uses Windows' built-in
ZIP-capable `bsdtar`, retaining Info-ZIP on Unix, and passes literal arguments without a shell.
The complete typecheck/lint/test/production pipeline then passed with the final dependency tree.
A subsequent UTF-8 charset repair passed a broader Japanese/Arabic filename regression and
Android's actual Rust archive consumer; both real OTA ZIPs were regenerated with that repair.
The browser smoke imports the actual emitted runtime and starts its compiled worker. The pinned
ORT module retains Node-only guarded imports of `module` and `worker_threads`; a blanket claim
that all emitted modules have no bare imports would be incorrect. Optional dependency warnings
alone were not treated as proof of a broken browser bundle. Unix Info-ZIP retains a pre-existing
non-ASCII filename/Rust-reader incompatibility: current public/build payload paths are ASCII,
but qualify non-ASCII paths before introducing them into Unix-built OTA archives.

Earlier physical-phone evidence established all-WebGPU model generation in a local development
APK. Complete partner-app card verification still requires a passing live run. Emulator replay
does not prove physical GPU generation; its WebView had no WebGPU adapter. Do not collapse unit,
replayed integration, real inference and fully rendered/verified card evidence into one pass.
The 2026-09-06 emulator check used WebView 151.0.7922.199 in the running APK: `navigator.gpu`
exists but both default and high-performance adapter requests return null. It cannot prove the all-WebGPU path.

The isolated install used npm `10.8.2` and local Node `24.14.1`. Frontend, Android and security
CI now agree on Node `24.18.1`; the complete hosted frontend checks on `e02bd70d4` passed
under that runtime. Later source changes still require their own validation.
CI uses read-only lint and frozen install, with no ad-hoc Rollup install that mutates the lockfile.
The local Windows production query used installed WSL `dfx@0.27.0`; CI pins the repository's
declared `0.31.0-beta.1`; the hosted frontend run above now passes with that exact toolchain.

## Historical security findings and feature-scoped review boundary

The findings and policy behavior in this section predate the developer's explicit exclusion
of core OpenChat audits. Preserve them without implying a waiver, a current advisory scan or
feature security clearance. Only model/app-card changes and their introduced or changed
dependencies belong in the remaining scoped review. Unrelated inherited core findings and
whole-lockfile baseline failures are not scoped blockers and do not authorize further scans.
Any advisory-service request or dependency-inventory upload still requires the appropriate
consent; there is no instruction here to run a whole-lockfile audit.

Both [PR1](../../.github/security/openchat-pr1-security-baseline.json) and
[PR2](../../.github/security/openchat-pr2-security-baseline.json) policies expired on
2026-08-31. Current manifests/lockfiles no longer match their reviewed digests. PR2 also reports
unreviewed native Cargo manifests. These failures were observed, not waived.

The cross-platform hash defect is corrected without approving new dependencies: 23 historical
records now hash UTF-8 with CRLF normalized to LF, backed by exact reconstruction of their
original reviewed bytes. The unproven PR2 root Cargo manifest remains byte-exact and fails.
Expiry, advisory allowances, reviewed file set and other policy fields remain unchanged.
The sole subsequent policy correction changes PR1's expected Node setup count from two
to three, matching the dependency, Android-component and frontend jobs. Actual-workflow
regressions reject missing, extra, relocated or wrongly pinned steps. Both checkouts pass
their offline helper suites (PR1 96; PR2 338); the real policy check still fails expiry and
dependency drift. Only the stale Node-count diagnostic disappeared. No expiry extension,
digest approval or advisory waiver was added. Evidence:
`ci-setup-count-20260907-auth-display/green-summary.json` and `preservation-proof.json`.
The repair was committed locally as PR1 `9686bfaac6fa8d994bca88656e77315f1ab09df7`
and PR2 `bdb5c00ff1c9c4c5ee2f805affed94f2f29b8750`; neither was pushed.

PR1 subsequently received the selective generic dependency backport in
`d0fed022537c325b52458cff6df3184510063eb0`: h2 0.4.16, event-listener 5.4.2,
removal of the unused legacy DynamoDB TLS connector, and optional debug telemetry with
the existing development opt-in preserved. Unrelated PR1 dependencies were not copied
from PR2. Locked/offline metadata and Android feature graphs, exact Rust formatting and
102 Node helpers passed. All three actual DynamoDB compatibility tests also passed, with
2,580 recorded source inputs unchanged; these use synthetic credentials and loopback HTTP,
not live AWS or a TLS handshake. Evidence: `pr1-remediation-review-20260907-39d104c9/validation.json`
and `pr1-dynamodb-runs/launch-d649cf2d8354452cb620a5fb038f5bdf/summary.json`.
This backport is not a fresh advisory audit or native model acceptance on PR1.

The following CI regression reproduced PR1's omission of the six launcher tests from
its actual frontend helper command. Adding that selection fixes the failure; both branches
now reject absent, commented, wrongly placed or non-enforcing test steps and filtered events.
The final offline helper suites pass 104/104 for PR1 and 340/340 for PR2, with no skips;
these are local source checks, not hosted execution or an advisory audit. Evidence:
`android-dev-ci-routing-20260907-9393afd3214e4924a3099c9f738601bc/green-summary.json`.

Fresh npm advisory results on 2026-09-06 for published `e02bd70d4`, after the scoped overrides:

| Dependency scope | High | Moderate | Low | Critical |
| ---------------- | ---- | -------- | --- | -------- |
| Production       | 0    | 2        | 0   | 0        |
| All              | 0    | 2        | 0   | 0        |

The public lockfile was byte-matched to SHA-256
`b68b016ac2d66b72e80a383db020b8b8502a36cb57802d29e72463f0bdc51b01` before the
independent audit. Hosted PR2 checks report the same counts. Both moderate entries arise from
one dependency chain, `@solana/web3.js@1.98.4` → `jayson@4.3.0` → `stream-json@1.9.1`,
and [GHSA-528h-pc64-c93x](https://github.com/uhop/stream-json/security/advisories/GHSA-528h-pc64-c93x).
The advertised patched `stream-json` major is incompatible with the installed parent; an
unverified override is not a fix. An isolated `jayson@4.1.3` downgrade satisfied Solana's
declared range and its Node/browser client checks, but restored parser regressions: malformed
JSON acceptance, missing incomplete-input errors and broken split UTF-8 input. It also retained
the demonstrated nested-prototype mutation. The downgrade was rejected and the current lockfile
retained; `npm audit`'s `fixAvailable` field is not a verified safe remediation. These results
do not establish current feature-scoped Rust, license, SBOM or exact-PR-base dependency
review; the unrelated inherited chain is retained here as historical evidence, not a blocker
for the requested model/app-card work.

Historical npm results for `808a75d3e`, before those scoped overrides:

| Dependency scope | High | Moderate | Low | Critical |
| ---------------- | ---- | -------- | --- | -------- |
| Production       | 5    | 3        | 0   | 0        |
| All              | 5    | 6        | 0   | 0        |

Compatible updates reduced the all-dependency total from 20 to 11 in this audit snapshot.
Tiptap is locked to 3.31.3 and DOMPurify to 3.4.14, above their patched minimums;
see the [Tiptap fix](https://github.com/ueberdosis/tiptap/releases/tag/v3.30.4) and
[DOMPurify advisory](https://github.com/cure53/DOMPurify/security/advisories/GHSA-55q2-fjhq-7xh7).
At that snapshot, remaining chains included Coinbase SDK/axios, Transformers/ONNX Node/adm-zip,
Transformers/sharp, jayson/stream-json and rollup-styles/query-string/decoder.
The local follow-up now pins only the reviewed Coinbase SDK `1.52.0`'s Axios to `1.18.1`.
An offline test against the actual installed SDK verifies signed request paths, BigInt serialization,
headers, responses, error mapping and retry integration, with an ephemeral key and no requests.
The compatibility check runs in frontend CI and requires reassessment if the SDK version changes.
The `query-string@8.2.0` decoder is separately pinned to `decode-uri-component@0.5.0` after
275 decoding cases, actual query-string option checks and a bounded malformed-input regression.
The repeatable installed-tree test is also in CI. Further scoped overrides now select
`adm-zip@0.6.0` only under `onnxruntime-node@1.24.3` and `sharp@0.35.3` only under
`@huggingface/transformers@4.2.0`. The actual ONNX installer passes 11 extraction/copy/cleanup
and bounded-allocation checks using an offline NuGet fixture. The actual Transformers Node
image helper passes 42 checks across image formats, channels, resampling, crop and padding;
24 independent old/new pixel-hash comparisons are identical. The frozen install retains all
optional packages, including cross-platform native wrappers. No model, ONNX or OCR runtime
version was changed. A `stream-json@3` override was rejected because the current `jayson`
parent requires incompatible CommonJS subpaths. Its Node TCP/CLI parser also reproduces
inherited-property injection; browser client reachability differs, which does not remediate the
installed Node package. Both security policies still fail; the older counts are retained
only to explain the remediation, not as the current lockfile audit.
A smaller overall total does not excuse a category increase.
These are dependency findings, not demonstrated browser exploitability. Further review is
limited to the introduced or changed model/app-card dependency closure, its runtime reachability,
licenses and notices. No full OpenChat license/SBOM or core compatibility audit is requested;
historical policy failure must not be relabeled as a current feature-scoped assessment.

A fresh official RustSec database (`5a0ebedfe8bdd2e295b171f4162f8c977bcad9a5`, updated
2026-09-02) was fetched into isolated storage without uploading dependency inventory. The
unchanged Cargo lockfile now reports **7 vulnerabilities / 32 warnings**, above the reviewed
5/30 snapshot. New findings include `RUSTSEC-2026-0258` for `h2@0.3.27` and `h2@0.4.15`,
plus yanked `chacha20@0.10.1` and `wnaf@0.14.0`. Do not reuse the earlier stale offline audit
as release evidence. Follow-up fixes update `h2@0.4` to `0.4.16` and `event-listener` to `5.4.2`,
and select the existing DynamoDB SDK's modern default HTTPS client without its unused legacy
TLS feature. This removes the vulnerable old `rustls-webpki` chain. Tests exercise real signed
DynamoDB requests against a local fixture server; strict Clippy passes. The native plugin's
22 tests also pass. Developer telemetry is now an explicit optional Cargo feature; normal and
all-WebGPU Android dependency graphs no longer contain the legacy `h2@0.3` chain. The
existing development opt-in remains available through `npm run mobile` and its tested launcher.

The recorded lockfile audit with that database and `--no-fetch --no-yanked` reported 3
vulnerabilities, 3 unsound findings and 26 unmaintained findings. Remaining vulnerabilities
are `h2@0.3.27` in explicitly enabled developer tooling and two RSA versions without a patched
range (`0.9.10`, `0.10.0-rc.18`). Optional dependencies remain visible in the lockfile audit;
they were not suppressed. That command did not recheck registry yanks. Those historical
findings and policy failures remain unresolved; no baseline was raised. Their presence does
not expand the current model/app-card scope into core auditing or remediation.

Offline Cargo metadata still matches the 19 PR1 introduced and four PR2 direct reviewed
package/license tuples. This is narrower than distribution clearance. The all-WebGPU asset
configuration now emits version-checked Wllama/embedded component notices independently of OCR,
and ORT/Transformers/model notices with the WebGPU payload. Modified Qwen graphs receive adjacent
notice sidecars. Immutable source cards and hashes document Gemma's optional audio and both graph
transform stages; the missing conversion-publisher metadata is stated, not invented. The built
distribution verifier requires the exact runtime, graphs and all 21 notice/sidecar outputs.
These checks establish packaging and attribution coverage, not inference or complete conversion
reproducibility. The stale `open` notice now matches locked `5.4.1`.

The pinned `cargo-cyclonedx@0.5.9` generator was also executed for the native model plugin with
`inference` features and all targets. It emitted 508 components; all 507 external package
identities/checksums in its isolated lockfile matched source `Cargo.lock` SHA-256
`04de513dc25b67d786d0650c17362fe5dece72d9a879c171e93e695d3d5aa33d`.
Because this generator has no `--locked` flag, the wrapper now forces offline resolution,
rejects source-lock mutation or isolated dependency drift before writing the report, and adds
both raw lock hashes and the scope as report metadata. Ten regression tests cover allowed
pruning and rejected version/source/checksum, Git revision and malformed-record changes.
This is subset lock-identity evidence, not dependency-edge/feature completeness, path-source
content proof, a full APK/model-weight SBOM or license/advisory acceptance. The policy command
still exits nonzero for the expired baseline and reviewed dependency drift; no waiver was added.

Frontend, backend and model/app security workflows now include the stacked PR base and
integration pushes, with regression tests for that routing. These changes are not on the
two older PR heads yet. Candid event routing and fail-closed checker regressions are now
covered locally, and the complete local parity run now passes as recorded above. Hosted
and broader integration workflows still need coordinated validation on the final stack.
Private/custom-runner jobs were not enabled blindly.
Absence of hosted check runs must not be reported as success.

## Publisher-only shipping guidance: not a local APK prerequisite

The developer will not build or publish the actual distribution APK. The signing, release
version, upload and rollout items in this section are handoff guidance for its publisher,
not outstanding requests for the developer's credentials or barriers to using the local APK.
Source/PR review and physical-device testing remain separate from APK publication.

- [All-WebGPU feature gating](../../frontend/app/transformersWebGpuFeatureFlag.mjs) retains
  development + local network + explicit opt-in. A separate production candidate contract,
  `OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY=immutable-hub-v1`, uses immutable Hub weight URLs
  and same-origin packaged Qwen graphs, ORT and worker. The development flag alone still
  cannot enable production. CI separately builds and verifies this candidate; that does not
  activate the shipping workflow or substitute for device/cache/CORS acceptance.
- [App capability gates](../../frontend/app/rollup.config.mjs) deliberately disable unfinished
  app-card features in production/testnet. Keep these security brakes until backend rollout
  and authorization acceptance are complete; frontend flags are not backend authority.
- [Android release workflow](../../.github/workflows/android_release.yaml) now accepts only
  exact `vX.Y.Z-android` tags or an explicit manual version input. It requires successful
  frontend, backend and both security workflows for the exact checked-out SHA before building
  and again before uploading. Missing, failed, queued, skipped, truncated, wrong-source or
  PR synthetic-merge evidence is rejected; workflow paths and individual jobs are checked.
  It uses read-only [GitHub Actions evidence](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow),
  not display-name matching. Old immutable tags still contain their old workflow:
  **do not publish the checkpoint tag as a GitHub Release**.
- That workflow builds native `inference` / `inference,store`, not the tested local
  `transformers-webgpu-android` path. Select and validate the intended shipping runtime first.
- CI now requires configured release signing and a pinned certificate for manual and published
  artifacts; no temporary/debug-key fallback. Local developer signing is unchanged. Actual
  release key configuration and application-link identity still require verification.
- The reviewed upstream formula derives the native version code as
  `major * 1,000,000 + minor * 10,000 + patch`, with validated bounds and matching Tauri/Gradle
  inputs. Full APK and store AAB identity/signatures are checked separately. Verify progression
  against the actual last distributed version code; supplying an inconsistent code is rejected.
  Local testing still uses its existing native version policy, not a fabricated publishing version.
- Android CI and Gradle now pin NDK `26.1.10909125` and build-tools `35.0.0`, matching
  the inspected local APK's native build note and Gradle execution history. APK verification
  requires that exact build-tools version. The existing Gradle `8.14.4` distribution has its
  [official SHA-256](https://gradle.org/release-checksums/) pinned; `dfx` is `0.31.0-beta.1`.
  These are source/toolchain preparation checks, not a rebuilt signed APK acceptance result.
- Verify production origin, model assets,
  optional audio, application links, account reuse and OTA policy in the final artifact.
- Run actual repeated image proposals and optional voice-message flows on supported hardware,
  including model switching, cached model reuse and explicit disabled/unavailable paths.

Generated APK resources are excluded by the precise root ignore rule. Source model graphs,
manifests and their notices remain tracked. No local account state, private environment file,
test profile, generated APK or signing material belongs in the submission.

## App/card backend compatibility and publisher rollout

Follow the [app-link security contract](../../architecture/ai-app-link-security.md) and
[ActionInbox rollout requirements](../../backend/canisters/action_inbox/README.md#v4-rollout-compatibility).
Coordinated versioned delivery, signing-key activation and independent consumer pins, inbox
wiring, legacy-queue handling and snapshot/rollback restrictions are separate acceptance gates.
Direct-chat deposits are not currently a supported backend rollout claim. Do not relax these
requirements to obtain a successful UI test.
The local test must prove the relevant existing backend authorization and app/card delivery
contract; performing a production rollout or rotating publisher keys is not a prerequisite
for the requested local APK. Production rollout remains a separately authorized publisher action.

## Reproduction and next actions

Use each proposed head's exact dependency lockfile and the existing reviewed model/app test
selections. Reuse installed dependencies when their identities match; a documentation or
recorded-fixture update does not require another install or full build. Do not use unfiltered
`npm test`, all `scripts/*.test.mjs`, or core-wide audits as new feature-scoped requirements.
For runtime source changes, select the changed model worker/graph/cache tests; for interface
changes, select the affected action/card/bridge tests and corresponding type/lint checks.
Run `scripts/model_ci_coverage.test.mjs` and, on PR2, `scripts/app_model_integration.test.mjs`
when their policy or discovery inputs change. Keep partner-specific recorded-output regression
tests in the partner repository, and label them separately from actual GPU inference.
Check whitespace with `git diff --check`. A needed production build belongs in an isolated
checkout, never the running development server's checkout.

Reuse successful native/WASM evidence only while its input identities still match. The selected
54-test integration gate now passes using the approved RAM socket path, with the existing
ignored capacity test explicitly unexecuted. Preserve its source-bound receipt; this is not
hosted native-Linux CI evidence or a request to expand to the historical 465-test full suite.
The source-bound September 9 Qwen local-test APK passed its emulator cold-start and
installed-asset checks, but it is behind the September 10 assembled worker. Its embedded
worker is 902,257 bytes (`5c8688…`), versus 962,323 bytes (`dd107de…`) for that assembled
worker. Rebuild a local-test APK from the intended final sources and verify its installed
assets before reusing any phone evidence. The separate 192-token diagnostic worker is not
a production build and must not be substituted as a qualified artifact.
Complete repeated phone Qwen and Gemma, model switching/cache reuse and authenticated
app/card checks, with optional voice tested if enabled. The prior receipt-card pass and
failed Qwen interval-image case do not qualify the latest runtime. Recheck phone availability
when that artifact is ready; earlier connection state is not current evidence. Then obtain final-stack
hosted checks. Keep dependency/license/notice review limited to introduced or changed model
and app/card dependencies; this reproduction list intentionally omits whole-lockfile advisory
commands and unrelated core compatibility audits. Any advisory-service request or inventory
upload requires separate appropriate consent. Do not mark the PRs ready or publish, deploy,
enable production features or upload artifacts without the corresponding evidence and authority.
The requested local APK does not require a shipping build or publisher credentials.

September 11 follow-up: both PRs now include the existing Rust advisory-transport,
feature-SBOM exporter and new offline collection test suites in the frontend's enforced CI inventory, with
per-suite omission checks. These are fixture tests, not live queries or release acceptance.
The scoped offline Rust collection CLI now exists in both checkouts. It validates the
explicit config/source/lock pins and invokes installed Cargo with `metadata --locked --offline`
for every configured profile; it cannot query advisories or approve release. Root independently
reran its 25 tests per checkout (50/50), plus 201/201 CI inventory/omission tests. Real sequential collection then completed all eight
configured profile calls with exit 0 and empty stderr, preserving the bound inputs:

- PR1: `output/rust-feature-collection-sFUAEi/summary.json`, SHA-256
  `aed1b874e16c016e5497d2d3eb095522c7136a1c41ffd32a40e11fbfe7798cbf`.
- PR2: `output/rust-feature-collection-8VoJ3t/summary.json`, SHA-256
  `9563ce96066afe537432d450160a8df93c003f84a1948461bf7221cbba69caae`.

These contain selected inventories, not root-completeness, advisory or release approval.
The legacy live Rust/SBOM commands remain blocked. The bounded source review record is
`admin/rust-scope-review-current-20260911.md` (SHA-256
`fb9321cd3f213a9cba0c8e496bd2d93d6bec717fc7df2ce7e9cab6dc6c5f8797`).
An explicit erratum corrects that review document's original shared-lock-hash assertion:
PR1 and PR2 have different lock hashes. Both owning configs and collection receipts already
validated their correct distinct locks; no collected evidence was relabeled.
It identifies exact nested-source pins, a separate release-tool context, and missing
target/feature profiles. The local arm64 all-WebGPU artifact is distinct from current
multi-target publisher workflows; PR2's app slice is not the inherited model/native union.
Native non-Rust notices remain a separate gate, not an excuse for a general core audit.

The next bounded review bound six supporting source files in each owning Rust config:
`BuildVersion`, `Timestamped`, and the manifests/implementations of the dependency-free
`canister_state_macros` and `git_commit_id`. Root read all six and verified identical LF hashes
in both checkouts. This adds no dependency seeds or profile claims. The configs now bind
101/242 files with their unchanged 109/232 seeds and four profiles; 66/66 focused seed/collector
tests pass. Current config hashes are PR1
`fad1f37e8d58784c58f5e2125a7adcc9a291a4fd68d12cd350903ff6f7199615` and PR2
`3ef5f4a492af171f2a35dccb808574bad2141e3487fcd2165cc8d20d0cc9eca3`.
The preceding real collection receipts retain their earlier config identities and are not
silently relabeled as collections of these newer configs. Scope completeness stays unresolved.

September 11 release-tool repair: `upgrade-canister.sh` and its local/prod/prod-test wrappers
now accept the caller's trusted Wasm SHA-256 as their final argument and forward it to the
Rust upgrader's existing required `--expected-wasm-sha256` guard. The base script takes seven
arguments; each wrapper takes five. The calling convention is:

```bash
./scripts/upgrade-canister.sh "$NETWORK" "$IC_URL" "$IDENTITY" "$CANISTER" "$VERSION" "$WASM_SRC" "$TRUSTED_WASM_SHA256"
./scripts/upgrade-canister-local.sh "$IDENTITY" "$CANISTER" "$VERSION" "$WASM_SRC" "$TRUSTED_WASM_SHA256"
```

The prod/prod-test wrappers use the same five arguments as the local wrapper. Pass an explicit
empty `WASM_SRC` argument to retain the default local-build selection. Use Bash/the executable
script, not `sh`. Obtain the digest independently from the trusted release/build record; the
scripts do not derive trust from the downloaded file. All four entrypoints reject a missing or
non-64-ASCII-hex digest before build/download/dfx/Cargo commands, preserve quoted arguments,
and propagate command failures. Root independently reran
`node --test scripts/upgrade_canister.test.mjs scripts/pr-ci-policy.test.mjs`: **32/32 passed**.
These use actual Bash with local command stubs, including malformed-input no-action checks,
exact forwarding, failure propagation and CI omission guards. The upgrade suite is now in
the frontend's enforced PR/release policy step. The root README and release-train's two
prod-test examples now use the same required-digest convention instead of stale three-argument
calls; unrelated release instructions were left unchanged. A final combined rerun with
`scripts/check_feature_ci.test.mjs` passed **148/148**, with no skips or advisory queries.
No actual build, download, canister upgrade,
Rust-guard weakening, or release acceptance is implied by these tests.

A subsequent fresh current-source ownership review has
cleared the stale npm fingerprints: both PRs retain 48 model files / 18 roots, and PR2 retains
44 app/card/local-reader files / 17 direct roots plus inherited model dependencies. The new
generic prompt selector uses built-ins only. All owning imports/build hooks were reviewed;
this was not a claim to reconstruct the unavailable prior dirty-tree source snapshot.
Historical snapshots were retained, and per-file raw/LF hashes were recorded separately.
The ownership suites pass PR1 39/39 and PR2 66/66; both read-only CLIs pass their current gates.
No advisory query, model download, production activation or APK rebuild accompanied this work.

`release_preflight.mjs` is an optional offline inventory, not a scoped release gate or approval
command. It checks the actual immutable model manifests, optional audio separation, source assets, toolchain declarations
and security drift without downloads, signing or deployment. It intentionally returns a nonzero
status while external acceptance remains unverified; inherited policy diagnostics are not
new core audit requirements. Optional version progression inputs must
come from the last actually distributed artifact, not guessed examples.
The report separates `gitHeadRevision` and `worktreeDirty`: it reads current working-tree and
installed asset bytes, not an atomic attestation that every input belongs to the Git commit.

### September 11 local-test APK and emulator startup

The current reconciled PR2 working tree produced local ARM64 APK
`2.0.0-local-webgpu-prompts-20260911`; this is not a public-release-signed artifact.
The build retained the existing local debug identity, development endpoints and OTA `none`.
Its owner-context launcher uses ordinary read-only Git without changing trust settings.
Before/after snapshots matched for 5,995 source files, four Git links and 15 builder inputs;
both lock files stayed unchanged. The canonical signing, DEX/component and fresh native-library
checks passed, as did the complete 26-asset distribution verifier. The packaged worker is
byte-identical to the retained current production worker (`dd107de1bc3fc1c91e7ac16165681f51941f8b9503991c443c1cd749394154ed`),
not the 192-token diagnostic variant. This does not qualify extraction accuracy.

The APK was installed over the existing emulator app without clearing its data. The expected
onboarding screen first became ready 5,742 ms after cold launch and remained ready through
the final observation. All 26 installed assets matched, the expected packaged version/origin
and OTA policy verified, and the worker acknowledged disposal. ORT import/WASM compilation
checks prove runtime loadability only, not inference or a CPU fallback. No account was linked,
model downloaded, image processed or card submitted by this smoke check. Physical-phone,
signed-in/account-retention and model-accuracy acceptance remain outstanding. The emulator
was then gracefully stopped in its owner context; its monitor recorded exit zero and cleanup.

- APK: `F:/Temp/OpenChat-IOU/OpenChat-local-test-prompts-20260911.apk`, 78,662,410 bytes,
  SHA-256 `8129fb21ea40a365394541513d6a392bcc33b96a29abe31c22f46a11d23ad05b`.
- Build source record: `tmp/apk-owner-source-identity-1d8c62903238420ab480eea3acd872ae/summary.json`,
  SHA-256 `092fbbbe5381a6f814a905047f52fbf75335d2ffa9fc8025e3ae4c5cca29863a`.
- Installed smoke: `tmp/apk-welcome-smoke-c68fee08f2614a5b9a6671c1bfa24084/smoke.json`,
  SHA-256 `6ce6f0880fb4ada7f056b70229cbf58a56599ec44a439618467ea275a4000572`.

The generic per-model prompt interface is included, but no unqualified external-app prompt
has been activated. The production 96-token output ceiling and existing phone image limits
remain unchanged. Root also reran the launcher’s 28 offline checks and the smoke helper’s
32 fixture checks; these are not substitutes for the installed smoke or model tests.
