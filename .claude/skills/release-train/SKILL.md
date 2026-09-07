---
name: release-train
description: OpenChat release train runbook — tagging components, prod-test (ic_test) double-deploy protocol, metrics verification, and prod release via SNS proposals. Use when releasing canisters or the website to prod test or prod, tagging a release, or checking release state.
---

# OpenChat release train

## Hard rules

- Claude NEVER creates tags, deploys, or submits proposals without an explicit per-action instruction. The developer runs all deploy/proposal commands himself; Claude's job is scope confirmation, exact commands, and metrics verification.
- Releases are tag-driven. Tags come first, always.
- Changelogs are cut ([unreleased] → versioned section) in a post-release tidy PR, NOT before the release.

## Phase 0 — scope and tags

1. Find the latest released tag per component (lexical sort lies — sort numerically):
   `git tag --list "v2.0.*-<component>" | sort -t. -k3 -n | tail -1`
2. Unreleased work per component:
   `git log --oneline <last-tag>..master -- backend/canisters/<component>` (frontend for website).
   A component whose only diff is CHANGELOG.md needs no release.
3. Canister version numbers are globally sequential across all canister components (next free number, regardless of component). Tag format: `v2.0.NNNN-<component>`, lightweight, at master head:
   `git tag v2.0.NNNN-<component> master && git push origin <tags...>`
   **The website no longer shares that sequence** (decided 2026-09-04). Its version drives the Android OTA gate, so its bump level is a decision, not the next free number. See step 3a.
3a. **Website bump level — ASK, do not assume.** The Android app compares its own version against `oc.app/version` and decides over the air whether to update itself. The component that moves decides who gets the release and who has to install a new binary. Getting this wrong ships a feature to Play Store users without Play ever reviewing it.

   Put the question to the developer explicitly, with the diff in hand:

   | Bump | When | Store build | Sideloaded build |
   |------|------|-------------|------------------|
   | patch `2.0.2051 → 2.0.2052` | Bug fixes, copy, styling. Nothing a reviewer needs to see. | OTA | OTA |
   | minor `2.0.2052 → 2.1.0` | A new user-facing feature. Any installed shell can still run it. | Play update | OTA |
   | major `2.1.0 → 3.0.0` | Web code that now depends on the shell: a new plugin command, a new Rust API, a new permission. Older shells cannot run this bundle. | Play update | New APK |

   `major` means INCOMPATIBLE, not big. A one-line dependency on a new Kotlin command is a major bump. A shell change that no web code calls yet is not a bump at all.

   Checks worth running before answering: `git log <last-website-tag>..master -- frontend/` for user-facing features, and `git log <last-website-tag>..master -- frontend/tauri-plugin-oc frontend/src-tauri` for anything that would make the bundle require a newer shell.

   Full detail in `frontend/tauri-plugin-oc/OTA_UPDATES.md`.

4. Release order is dependency-driven, decided per train. Rule of thumb: a canister must accept a new candid field before anything starts sending it (e.g. video transcode train: storage_bucket → storage_index → website). Website last.
5. Pushing a tag triggers CI to build and upload wasms to S3 keyed by COMMIT id (`https://openchat-canister-wasms.s3.amazonaws.com/<commit>/<canister>.wasm.gz`). The prod proposal route downloads from there — confirm the CI run finished before prod release.

## Phase 1 — prod test (ic_test)

Work through components in release order. For each canister, the **double-deploy protocol**: deploy the new wasm twice, first labelled version tag−1, then labelled tag. This exercises the upgrade path twice (catches non-idempotent migrations). "tag−1" = the new tag number minus 1 (NOT the component's previous released tag).

```bash
sh ./scripts/upgrade-canister-prod-test.sh openchat <canister> 2.0.<tag-1>
# check metrics (below), then:
sh ./scripts/upgrade-canister-prod-test.sh openchat <canister> 2.0.<tag>
# check metrics again
```

No 4th arg (wasm_src) → the wasm is BUILT LOCALLY from the current checkout, so the working tree must be at the tag commit (master head, clean). Both deploys therefore carry the new code's git_commit_id — expected.

Website prod test is a single deploy, no double protocol (asset canister, no upgrade path):

```bash
sh ./scripts/deploy-website-prod-test.sh openchat 2.0.<tag>
```

Then the developer smoke-tests the prod-test site manually, exercising the features in the train.

### Metrics checks

`curl -s "https://<canister_id>.raw.icp0.io/metrics"` — ic_test ids in `canister_ids.json` at repo root.

- storage_bucket has no direct id: read storage_index metrics (`ic_test: 6jemw-paaaa-aaaaf-ab2ea-cai`) and check `active_buckets[].wasm_version`; hit an individual bucket id from that list for bucket-level detail.
- Verify after each deploy: `wasm_version` matches what was just deployed, `git_commit_id` = tag commit, queue lengths zero (e.g. `index_sync_queue_length`, `pending_files`, `expiration_queue_length`), failure counters zero, entity counts (users/blobs/files) unchanged from before the upgrade, cycles balance sane.

## Phase 2 — prod (SNS proposals)

Before creating ANY prod proposal: write `./local/summary.md` with the proposal text, drawn from the relevant component's CHANGELOG.md `[unreleased]` section and/or the commit history since the last released tag. The developer MUST review `./local/summary.md` before the proposal script is executed — never run a proposal script against unreviewed text.

### Canisters

Per-canister wrapper scripts in `scripts/proposals/` (e.g. `upgrade_storage_buckets.sh`, `upgrade_storage_index.sh`, `upgrade_user_index.sh`...) wrap `make_upgrade_canister_proposal.sh` with the right SNS function id. Args: version + path to the reviewed summary file:

```bash
sh ./scripts/proposals/upgrade_storage_buckets.sh 2.0.<tag> "<abs path to local/summary.md>"
```

The script downloads the wasm from S3 at the tag commit, hashes it, and embeds verification instructions in the proposal summary.

After the proposal is submitted, it is customary for the developer to reply to the proposal message confirming the wasm hash is as expected. Claude should tell the developer the expected hash — compute it independently:

```bash
curl -s https://openchat-canister-wasms.s3.amazonaws.com/<tag commit>/<canister>.wasm.gz | sha256sum
```

When the developer says the proposal has executed, Claude checks the canister's prod metrics (same checks as Phase 1, `ic` ids) to confirm the new version is live with no obvious errors, before the next component's proposal is submitted.

### Website

**A major website bump changes the order.** Store and sideloaded users cannot cross a major boundary over the air, and they are not broken by it, they simply freeze on the bundle they already have until a new binary reaches them. So for a major release, get the Android shell out first:

1. Release the canisters as normal.
2. Build the AAB, submit to Play, wait for approval AND rollout. This is the step whose duration you do not control, so start it early.
3. Publish the APK for sideloaded users.
4. Deploy the website last, as always.

This assumes `assetlinks.json` already claims the package with both fingerprints, the upload key and Play's app signing key. It does from the second release onwards. For the FIRST release of a new package name that is not true, and the order is different: nothing may be distributed until the deployed assetlinks lists it. See `frontend/src-tauri/PLAY_STORE_RELEASE.md`.

That makes a constraint that is otherwise incidental load-bearing: the canisters must be LIVE before the AAB is submitted, because the AAB bundles the new web assets and runs them the moment someone installs, possibly days before the website deploy.

For patch and minor bumps none of this applies. OTA delivers them and the Android shell ships whenever convenient.

Before the prod proposal, deploy the website to **web-test**. Web-test runs against the live prod backend, so do this once the backend canisters in the train are released and up to date on prod. It is the final check that the website is safe to deploy:

```bash
sh ./scripts/deploy-website-web-test.sh openchat 2.0.<tag>
```

The developer smoke-tests web-test, then stages the prod assets:

```bash
sh ./scripts/prepare-frontend-assets.sh openchat 2.0.<tag>
```

builds and stages assets via `dfx deploy --network ic --by-proposal website`, printing a **batch id** and **evidence hash**. Then, with the reviewed `./local/summary.md`:

```bash
sh ./scripts/proposals/commit_frontend_assets.sh 2.0.<tag> "<abs path to local/summary.md>" <batch_id> <evidence_hash>
```

(SNS function 10000, commits the staged asset batch.)

## Phase 3 — post-release

- Verify prod metrics / live site `/version`.
- Tidy PR: cut each released component's CHANGELOG.md `[unreleased]` section to `## [[2.0.NNNN](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.NNNN-<component>)] - <date>`.
- Update the release-train memory/status.
