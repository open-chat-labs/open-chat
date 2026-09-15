# Selected Rust advisory triage — September 14

This review classifies the **ten findings already returned by the permitted PR2
request**. It performs no new dependency query, no whole-core audit, no dependency
upgrade, and no advisory waiver. At initial triage, PR1's live request was unapproved.
It was subsequently explicitly approved and completed: 481 selected identities,
including seven Git packages, produced the identical ten advisory/package/version
tuples below. PR1's completed summary SHA-256 is
`64824d53be0ca74e591b374802d1bf280326891bd1bf35e2aeef9a486a615a95`.
The same source-context categories are present in PR1's captured results; its RSA
finding is limited to the selected Windows-test profile. This does not extend the
review to whole-APK or whole-repository reachability.

The captured PR2 report SHA-256 is
`87dc8a9af5a043a7c73e78721d4dc3bc7425c341b1494a769031a7104dad2aee`.
Its exact selected dependency graph and source-context provenance are the basis
for the paths below.

## Classification and selected ownership

| Package                  | Advisory classification                                                                    | Selected dependency path/context                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| backoff 0.4.0            | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2025-0012.html)                      | PocketIC 11.0.0 integration tests                                                 |
| instant 0.1.13           | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2024-0384.html)                      | PocketIC → backoff; integration tests                                             |
| serde_cbor 0.11.2        | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2021-0127.html)                      | PocketIC integration tests                                                        |
| paste 1.0.15             | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2024-0436.html)                      | Includes Candid 0.10.34; selected canister and test source paths                  |
| rsa 0.10.0-rc.18         | [Timing-side-channel vulnerability](https://rustsec.org/advisories/RUSTSEC-2023-0071.html) | Shared authentication test helper; selected Windows integration-test profile only |
| unic-char-property 0.9.0 | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2025-0081.html)                      | Tauri → tauri-utils → urlpattern → unic-ucd-ident                                 |
| unic-char-range 0.9.0    | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2025-0075.html)                      | Same native build/production source-context family                                |
| unic-common 0.9.0        | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2025-0080.html)                      | Same family, through unic-ucd-version                                             |
| unic-ucd-ident 0.9.0     | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2025-0100.html)                      | Tauri 2.11.5 → tauri-utils 2.9.3 → urlpattern 0.3.0                               |
| unic-ucd-version 0.9.0   | [Unmaintained](https://rustsec.org/advisories/RUSTSEC-2025-0098.html)                      | Same family, through unic-ucd-ident                                               |

RustSec classifies nine as informational maintenance notices, not nine additional
reported vulnerabilities. Its RSA advisory describes potential private-key recovery
through observable timing and lists no patched version. The captured scoped graph
places this RSA identity only under the shared test helper; it does not show it in
the selected Android model/app profiles. That is **not** a whole-APK absence claim
or an exploitability assessment.

## Baseline comparison

All ten exact name/version/source/checksum identities are present in both local
base lockfiles:

- Before PR1: `df9d9ed52db00e87fbb7309280a325902c9bb2cc`;
  lock SHA-256 `50f79a004d87af1c9bd353dcc3e86e9da1ed965d83c1e213dd511e22b665f320`.
- Before PR2: `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b`;
  lock SHA-256 `59b4adb8a599bfee86ef20fe52b6d8c21b1414226323aae35456259cc4ac013b`.

This rules out newly introduced **versions** for these ten findings. It does not
prove unchanged feature reachability, dismiss existing vulnerabilities, or grant
a release exception. Cargo production/build/test source contexts and resolved
workspace feature unions are not shipping-binary reachability.

## Disposition

The user explicitly requested documentation and skipping further inherited-advisory
decisions for this scoped task. These findings are documented and deferred, not a
remaining user-approval or local-preparation blocker.

The original conservative advisory gate remains failed; no finding has been
suppressed and no scanner gate has changed. The deferral does not assert that
the findings are harmless or override upstream CI/release policy. Replacing shared
framework, authentication or core dependencies is outside this task and has not
been attempted.

The PR1 query approval is resolved for the completed invocation. Current-APK
physical-phone qualification remains outstanding. The private catalog is sufficient
for local model testing; public model hosting is a later distribution concern.
