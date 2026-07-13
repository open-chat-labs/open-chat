# Personhood verification — production rollout runbook

This is the ordered sequence of steps (mostly SNS proposals) which takes the
in-house personhood verification system ([#9072]) from "code merged" to "live
and enforced" on production. It supersedes the phase 4 sketch in the issue
comments.

[#9072]: https://github.com/open-chat-labs/open-chat/issues/9072

## The canister id is fixed

The production canister already exists: **`wji62-oiaaa-aaaaf-bsc7a-cai`**,
hardcoded as `PERSONHOOD_VERIFIER_CANISTER_ID` in the `constants` crate and
recorded in `canister_ids.json`. The user_index authenticates the verifier
against this constant — there is no wiring step and no init-arg plumbing.
Local deployments and the integration tests create the canister with this
exact id (specified-id creation), so the constant is correct in every
environment.

## Why the order matters

Two hard constraints drive everything:

1. **Users must have a working way to verify before anything new requires
   verification and before any legacy proof is wiped.** New unique-person
   gates and prize restrictions stay uncreatable (phase A feature flag,
   step 6) until real-world verification data looks healthy (phase B,
   step 9); the wipe (step 8) sits between them. Existing pre-sunset gates
   re-enforce earlier, at step 3 — see the note in step 6.
2. **Every canister that (de)serialises `UniquePersonProof` must understand
   the new `OpenChat` provider variant before any such proof exists**,
   otherwise `local_user_index` / `user` canisters panic on an unknown
   variant. So children upgrade before parents, and the whole backend
   upgrades before the verifier can issue proofs.

Each numbered step below should complete (and, where noted, bake) before the
next starts.

## Trust model recap

| Action | Who | Why it's safe |
|---|---|---|
| Upload model chunks | Dev principals on `upload_model_chunks_whitelist` (init arg, mirrors `openchat_installer`'s `upload_wasm_chunks_whitelist`) | Chunks are inert. Nothing reads them until a commit activates them. |
| Activate a model (`commit_model`) | SNS proposal only (function 11000) | Hash-pinned: the commit no-ops unless the assembled chunks hash to exactly the sha256 in the voted-on payload. Weights are also structurally validated by tract before activation. |
| Tune uniqueness thresholds | SNS proposal only (function 11001) | Runtime-governable bands; invariant `clear <= duplicate_retry <= duplicate` enforced on-chain. |
| Wipe legacy DecideAI proofs | user_index upgrade proposal (post_upgrade one-liner in a designated release) | Deliberate, one-off, run late in the sequence; voters see it in the upgrade changelog. |
| Upgrade the verifier wasm | SNS proposal (native "Upgrade SNS controlled canister") | Standard external-canister upgrade path. |

The `governance_principals` init arg must be exactly
`[ SNS governance canister ]` in production. Controllers (SNS root, post
registration) are implicitly trusted by the guard, which grants them nothing
they don't already have.

---

## Step 0 — prerequisites

- This PR merged; release wasms built via `./scripts/docker-build-all-wasms.sh`
  (deterministic build, hashes verifiable by voters with
  `./scripts/verify-release.sh`).
- Decide the upload whitelist principals. Convention: the same dev principals
  as `openchat_installer`'s `upload_wasm_chunks_whitelist` (visible on its
  `/metrics` endpoint).
- Model files present and hashed:
  `./scripts/download-personhood-models.sh` fetches
  `version-RFB-320.onnx` (detection, ~1.2 MB), `2d106det.onnx` (landmarks,
  ~5 MB), `w600k_r50.onnx` (embedding, ~174 MB) and verifies each against a
  sha256 pinned in the script itself — i.e. in the reviewed repo, alongside
  the upstream onnx/insightface URLs. The commit proposals in step 5 pin
  these same hashes, so voters can trace proposal payload → repo constant →
  upstream release.
- `didc` and `quill` installed; `.env` configured with `NETWORK=ic`,
  `PROPOSER_NEURON_ID`, `PEM_FILE` etc. (same setup as any other proposal
  script).

## Step 1 — install and register the verifier canister

The canister exists (see above) but is empty and dev-controlled.

1. Install the release wasm with production init args:

   ```candid
   (record {
     governance_principals = vec { principal "2jvtu-yqaaa-aaaaq-aaama-cai" }; // SNS governance
     upload_model_chunks_whitelist = vec { /* dev principals from step 0 */ };
     user_index_canister_id = principal "4bkt6-4aaaa-aaaaf-aaaiq-cai";
     cycles_dispenser_canister_id = principal "gonut-hqaaa-aaaaf-aby7a-cai";
     wasm_version = record { major = ...; minor = ...; patch = ... };
     test_mode = false;
   })
   ```

2. Set the SNS root canister (`3e3x2-xyaaa-aaaaq-aaalq-cai`) as an additional
   controller, then submit the **RegisterDappCanisters** proposal:

   ```bash
   ./sns/scripts/proposals/register_canister_with_sns.sh personhood_verifier "Register the personhood_verifier canister with the SNS" "<PR url>" "<summary>"
   ```

   Once adopted, remove the dev identity as controller (SNS root does this as
   part of registration; verify with `dfx canister --network ic info`).
3. Whitelist it with the cycles dispenser:

   ```bash
   ./scripts/proposals/add_canister_to_cycles_dispenser.sh wji62-oiaaa-aaaaf-bsc7a-cai "<summary>"
   ```

**Verify:** `https://wji62-oiaaa-aaaaf-bsc7a-cai.raw.icp0.io/metrics`
responds; `inference_engines_ready` is `false`, `current_model_version` is
`0`, `governance_principals` and `upload_model_chunks_whitelist` show exactly
the intended principals. Controller list is SNS root only.

**At this point nothing is user-visible.** The canister accepts no
verifications (no models are committed).

## Step 2 — register the SNS generic functions

```bash
./scripts/proposals/register_personhood_verifier_functions.sh
```

Submits an `AddGenericNervousSystemFunction` proposal per function:

| Id | Function | Target |
|---|---|---|
| 11000 | `commit_model` | personhood_verifier |
| 11001 | `set_uniqueness_thresholds` | personhood_verifier |

Ids were verified free (and unreserved) against the live registry on
2026-07-13; re-check with `list_nervous_system_functions` before submitting.
Validators are the `<method>_validate` queries the `#[proposal]` macro
generates on the personhood_verifier itself, so registration can happen any
time after step 1.

**Verify:** the functions appear in `list_nervous_system_functions` with the
right target/validator method names.

## Step 3 — ship the type-aware backend

Upgrade, in this order (children before parents, so no canister ever receives
a variant it can't decode):

1. `user` canisters — `./scripts/proposals/upgrade_users.sh <version> <changelog>`
2. `local_user_index` canisters — `./scripts/proposals/upgrade_local_user_indexes.sh <version> <changelog>`
3. `user_index` — `./scripts/proposals/upgrade_user_index.sh <version> <changelog>`

Also upgrade `group`/`community`/`group_index` on the normal release cadence —
they carry the `UniquePerson` gate-evaluation changes but these are inert
until proofs of the new provider exist.

These versions understand the new `OpenChat` proof provider and
`model_version`, accept `c2c_notify_personhood_verified` (authenticated
against the hardcoded verifier canister id), and carry the gate code. The
verifier still has no models, so no proofs can be produced and behaviour is
unchanged.

**Verify:** normal post-upgrade checks; existing DecideAI badges still render;
nothing personhood-related is reachable.

**Bake:** at least one full user-canister rollout cycle before step 5 (the
user canister fleet takes time to upgrade; the proof fan-out must not race
it).

## Step 4 — upload the models (inert)

Run from a whitelisted dev principal — no proposal needed because the chunks
are inert (~180 x 1MB update calls for the embedding model alone, which is
also why this isn't proposal-per-chunk):

```bash
./scripts/download-personhood-models.sh
cargo run --package verification_model_uploader -- \
  --url https://ic0.app/ \
  --controller <whitelisted dfx identity> \
  --personhood-verifier wji62-oiaaa-aaaaf-bsc7a-cai \
  --models-dir ./backend/personhood_bench/models \
  --embedding-version 1 \
  --skip-commit
```

The tool prints the three ready-made commit commands with the exact sha256
hashes when it finishes.

**Verify:** the printed hashes match the hashes published by
`download-personhood-models.sh` in step 0 (they are computed from the
same local files, so this is a sanity check against upload corruption only —
the real integrity check is the hash pin in step 5).

## Step 5 — activate the models by proposal

One proposal per model kind (paste the sha256 values printed in step 4, and
include them plus the upstream insightface reference in each proposal summary
so voters can verify what they're activating):

```bash
./scripts/proposals/commit_personhood_model.sh Detection 1 <sha256>
./scripts/proposals/commit_personhood_model.sh Landmarks 1 <sha256>
./scripts/proposals/commit_personhood_model.sh Embedding 1 <sha256>
```

Submit Embedding last: the inference engines only build once all three models
are committed, so `inference_engines_ready` flips to `true` exactly when the
final commit executes. Committing the embedding model bumps
`current_model_version` to `1`.

Safety properties, for the proposal summaries:

- A commit **no-ops** (`HashMismatch`) if the uploaded bytes don't hash to
  the pinned sha256 — including if anyone uploads different chunks between
  proposal submission and adoption.
- The weights are structurally validated (tract model build) before
  activation; a commit that produces an unloadable engine rolls itself back
  (`InvalidModel`).

Once the final commit executes, verification is end-to-end functional for
anyone calling the canister directly (there is still no UI): the user_index
already accepts the verifier's proof notifications because it authenticates
against the hardcoded canister id.

**Verify:** `/metrics` shows all three `ModelRecord`s with the right hashes,
`current_model_version = 1`, `inference_engines_ready = true`. The
`model_info` query returns version 1. Then run one real verification
end-to-end with a test account (camera flow via a local frontend pointed at
prod, or direct canister calls): the unique-person badge appears for that
account and `enrolled_embeddings` on `/metrics` ticks to 1.

## Step 6 — ship the frontend, phase A: users can verify, nothing new can require it

The website carries a build-time feature flag,
`OC_UNIQUE_PERSON_REQUIREMENTS_ENABLED` (`frontend/app/src/utils/featureFlags.ts`).
**Phase A is the default build — leave the env var unset.** Deploy via the
usual frontend proposal flow (upload assets, then `commit_frontend_assets`,
function 10000). The iOS/macOS camera permission entries ride with the native
app store builds.

With the flag off:

- The verification flow, badges, and the gate evaluator (shown when a user
  hits an *existing* unique-person gated group) are all live — **users can
  now actually verify.** This closes the coordinated window opened in step 3.
- The unique-person option in the access-gate builder is greyed out and the
  unique-person restriction on prize messages is hidden — **no new
  requirements on verification can be created** until the system is proven.

Note on existing (pre-DecideAI-sunset) unique-person gates: the backend
enforces them for real from step 3, exactly as it did before the DecideAI
sunset stub. Legacy proofs keep passing until the wipe; users without one
are blocked from joining (and lapsed by expiring gates) until they verify —
which phase A gives them the tool to do. Keep the step 3 → step 6 window
short for this reason.

**Verify:** verification flow works in production from a clean browser
profile; badge appears; re-verification of the same face by a second account
is rejected as a duplicate; the gate builder shows "Unique person" greyed
out; the prize builder shows no unique-person restriction.

**Bake:** leave the system running with organic verifications until you have
confidence in the real-world numbers — false-reject reports in line with the
~1% calibration, duplicate detections plausible, queue depth and cycles
stable. Watch `/metrics` (enrolled_embeddings, queue depth, attempts) and
canister logs. This is the checkpoint the two-phase split exists for: phase B
is a judgement call made on this data.

## Step 7 (optional, any time) — tune thresholds

Launch defaults are `duplicate 0.55 / clear 0.45 / duplicate_retry 0.50`
(r50-calibrated on LFW, ~1% innocent-rejection at ~100k enrolled). As the
enrolled population grows, raise the bands by proposal:

```bash
./scripts/proposals/set_uniqueness_thresholds.sh 0.55 0.45 0.50
```

**Verify:** `/metrics` reflects the new `uniqueness_thresholds` immediately.

## Step 8 — wipe the legacy DecideAI proofs

Only after phase A has baked (users must have a working re-verification path
the moment their badge disappears).

The trigger is a one-line `post_upgrade` change in the user_index: set
`data.wipe_legacy_unique_person_proofs = true` (and restart the
`remove_lapsed_unique_person_proofs` job) in whichever user_index release the
team ships once phase A looks healthy. **It must not ride the step 3
release** — the sweep starts the moment that upgrade lands. The wipe is
approved like any other upgrade, via the user_index upgrade proposal whose
changelog says exactly this.

This triggers the one-off removal fan-out (user_index → LUI → user). It is
**irreversible** — the DecideAI proofs cannot be restored — which is why it
sits this late in the sequence. Remove the `post_upgrade` line again in the
following release (the flag self-clears when the sweep completes, so this is
belt-and-braces).

**Verify:** legacy badges disappear; affected test account can re-verify via
the new flow.

## Step 9 — ship the frontend, phase B: verification can be required

Once phase A metrics look healthy and the wipe has settled, rebuild the
website with the flag on — **no code change, same commit is fine**:

```bash
OC_UNIQUE_PERSON_REQUIREMENTS_ENABLED=true <usual website build>
```

and deploy by proposal as usual. This enables creating unique-person access
gates and unique-person-restricted prize messages. Announce a publicised
grace window (suggested: 2–4 weeks, in the OpenChat community) so members of
gated communities have time to re-verify before owners start relying on the
gates again.

After phase B ships, remove the flag from the codebase (it defaults new
builds to phase A behaviour forever otherwise).

---

## Later: upgrading a model

Same shape as steps 4–5: upload new chunks with the uploader
(`--embedding-version N+1 --skip-commit`), then one `commit_personhood_model.sh`
proposal per changed kind. Committing a new **embedding** model:

- bumps `current_model_version`,
- starts the 90-day lapse window for proofs/embeddings of the previous
  version (users re-verify in-app; expired ones lose the badge), and
- notifies the user_index so clients start prompting re-verification.

Detection/landmark model swaps don't lapse anything but do change the
pipeline; treat them as requiring the same care as an embedding bump unless
measured otherwise.

## Rollback / incident notes

- **Bad model committed** (engines built but behaviour wrong): commit a fixed
  model at `version+1` — or, to halt verification entirely, upgrade the
  canister wasm by proposal with verification paused. There is no
  "uncommit".
- **Thresholds wrong** (false-reject spike / duplicate leak): a single
  `set_uniqueness_thresholds.sh` proposal fixes live state; no upgrade needed.
- **Wipe fired early**: cannot be rolled back. The only mitigation is
  accelerating step 6 so users can re-verify. This is the step to
  triple-check ordering on.
