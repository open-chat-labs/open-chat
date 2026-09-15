# Scoped Rust source-review receipts

The incomplete seed inventory and its successful metadata collection are not
source-scope acceptance. A reviewer can close the inventory's remaining gaps in
a separate, versioned `scripts/rust_feature_review.pr1.json` or
`scripts/rust_feature_review.pr2.json`, belonging to that same checkout.

The collector reads only that fixed path. There is no command-line completeness
override. A missing receipt preserves the incomplete result; an invalid or stale
receipt fails before Cargo or advisory transport. Its exact bytes are bound and
rechecked throughout collection and CI. Only successful collection of every
declared profile promotes the summary to the reviewed completion state.

## What the receipt establishes

The receipt records a source review, not automatic Rust analysis. The reviewer
must first establish the intended feature boundary and trace its direct, nested,
generated and caller-side owner edges. Merely generating a receipt from the
inventory, hashing the same files, or assigning a nonempty explanation does not
perform that review. A reviewer must not use this mechanism to conceal a known
omission or to expand the task into an unrelated core audit.

The validator checks the following mechanical obligations:

- The base inventory still passes all source, lock, seed and profile validation.
- `configSha256` matches the inventory bytes under strict UTF-8/LF normalization.
- Every configured source has an explicit, line-bound review disposition.
- Every seed/profile pair is accounted for without introducing another profile.
- Owner-edge units include the seed's owner manifest and every existing evidence
  line; no-edge units cannot assign dependency roots.
- Every unresolved inventory gap is resolved exactly once and cites existing
  review units. Unknown gaps, units, sources, seeds and extra fields fail.

These checks bind the review conclusion to its evidence. They do not discover
unlisted source files or prove semantic call-graph completeness automatically.
The receipt and the selected boundary therefore require substantive source review,
just like the inventory itself.

## Format

A version-1 receipt has exactly these fields:

- `schemaVersion`: `1`.
- `configSha256`: SHA-256 of the corresponding UTF-8/LF inventory document.
- `boundary`: substantive description of the reviewed feature boundary.
- `units`: nonempty array of review units, each containing `id`,
  `disposition`, `explanation`, `profiles`, `sources`, and `seeds`.
  A source is `{ "path": "repository/relative/path", "lines": [1] }`.
  Disposition is `external-owner-edges` or
  `no-additional-external-owner-edge`.
- `resolutions`: one `{ "id": "...", "explanation": "...", "units": ["..."] }`
  for each outstanding gap in the base inventory.

Use separate units when seeds have different applicable profiles. Unchanged
siblings in a mixed-purpose crate are not selected merely because their manifest
is reviewed. Cargo kind and the inventory's production/build/test origin remain
unchanged.

## Acceptance limits

A validated receipt does not authorize external queries and is not an advisory,
licence, native-binary, model-accuracy, APK, delivery, whole-repository or release
pass. Fixture collection and fixture advisory transport never grant real CI
acceptance. Selected Git sources are queried by their resolved immutable commit;
they are never substituted with same-name crates.io releases. As documented by
[OSV](https://google.github.io/osv.dev/post-v1-querybatch/), commit and registry
queries can share a batch and have independently exhausted pagination.

The planner retains a separate source-package trace for crates sharing a commit.
Git findings are commit-wide, not proof of crate-level applicability. An empty
response establishes only no known findings for that query: it does not prove
that a fork is indexed or secure. Path and noncanonical-registry sources remain
unqueried and prevent scoped CI acceptance. The explicit transport mode is
`query-selected-identities`; the former registry-only mode is rejected.
Whole-repository and release acceptance remain false.

September 14 status: both slices now have actual versioned receipts for their
bounded model (PR1) and additive app/card (PR2) owner reviews. Fresh installed-Cargo
collection passes all five PR1 and seven PR2 profiles, with unchanged source
bytes and validated selected SBOMs. PR2's final nested payload/module pass added
59 source pins, without changing its 255 dependency seeds or seven profiles.
The review accounts for 347 sources and 436 seed/profile pairs in PR2; its
487 relevant policy/validation tests pass. These are not model-accuracy tests.
The base inventories intentionally retain their incomplete-inventory contract;
acceptance is conveyed by the separately validated review, not a flag flip.
Neither result grants advisory or release clearance.
