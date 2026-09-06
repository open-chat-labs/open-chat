use crate::guards::caller_is_storage_index_canister;
use crate::model::index_event_batch::EventToSync;
use crate::model::vault::VaultOpOutcome;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_vault_sync::{Response::*, *};
use storage_index_canister::c2c_sync_bucket::CsamHashDenylisted;
use tracing::{error, info, warn};

#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_vault_sync(args: Args) -> Response {
    mutate_state(|state| c2c_vault_sync_impl(args, state))
}

fn c2c_vault_sync_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let mut quarantine_failures = Vec::new();

    for op in args.ops {
        match op {
            VaultOp::Quarantine(q) => {
                // The blob may already be vaulted: a second report can quarantine the same
                // blob, and a quarantine is re-sent alongside the verdict in case the original
                // was lost. Register the claim rather than re-quarantining, since the file
                // record itself may be long gone (only the blob survives, under the vault pin)
                // and taking a fresh pin would fail.
                if state.data.vault.claim_if_quarantined(q.file_id, q.metadata.report_index, now) {
                    info!(file_id = %q.file_id, "Vault: already quarantined, claim recorded");
                } else if let Some((hash, mime_type)) = state.data.files.vault_pin(&q.file_id) {
                    state.data.vault.quarantine(q.file_id, hash, mime_type, q.metadata, now);
                    info!(file_id = %q.file_id, "Vault: quarantined");
                } else {
                    // Evidence capture failed (eg. the file was deleted before the op arrived).
                    // Loud by design: silent loss is the worst failure mode for an evidence vault.
                    error!(file_id = %q.file_id, "Vault: quarantine failed, file not found");
                    state.data.vault.record_quarantine_failure();
                    quarantine_failures.push(q.file_id);
                }
            }
            VaultOp::Unquarantine(u) => {
                let file_id = u.file_id;
                match state.data.vault.unquarantine(u.file_id, u.moderator, u.report_index, now) {
                    VaultOpOutcome::ReleasePin(hash) => {
                        state.data.files.vault_unpin(&hash);
                        state.data.vault.clear_blocked_attempts_for_hash(&hash);
                        info!(%file_id, "Vault: unquarantined");
                    }
                    VaultOpOutcome::Retained => {
                        // A claim released even though siblings retain the pin: sightings
                        // anchored to the released report are stale, and the next attempt
                        // must re-report against a remaining claim rather than be silenced
                        // (I14) - the anchor changed, which is a hash transition too
                        if let Some(hash) = state.data.vault.hash_for_file(&file_id) {
                            state.data.vault.clear_blocked_attempts_for_hash(&hash);
                        }
                        info!(%file_id, "Vault: release deferred, other reports still hold the blob");
                    }
                    VaultOpOutcome::Blocked => {
                        error!(%file_id, "Vault: unquarantine refused, record is under legal hold");
                    }
                    _ => (),
                }
            }
            VaultOp::ApplyVerdict(v) => {
                // Loud on NotFound: a verdict landing on a missing record means evidence that
                // should have been held was already released - the worst failure mode.
                // Existing copies of the blob are deliberately NOT swept: every reported copy
                // gets its own human verdict, and the denylist only gates FUTURE uploads.
                match state.data.vault.apply_verdict(
                    v.file_id,
                    v.retention_until,
                    v.moderator,
                    v.reanchor.unwrap_or_default(),
                    v.report_index,
                    now,
                ) {
                    VaultOpOutcome::NotFound => {
                        error!(file_id = %v.file_id, "Vault: verdict for a file that is not quarantined");
                    }
                    // Tell the index so every other bucket denylists the hash too, otherwise
                    // the same content uploads again elsewhere and is served publicly
                    VaultOpOutcome::AppliedDenylisted(hash, report_index) => {
                        state.data.vault.clear_blocked_attempts_for_hash(&hash);
                        state
                            .data
                            .push_event_to_index(EventToSync::CsamHashDenylisted(CsamHashDenylisted {
                                hash,
                                report_index,
                                derived: Some(false),
                            }));
                        denylist_source_hashes(&hash, report_index, state);
                    }
                    _ => (),
                }
            }
            VaultOp::SetLegalHold(l) => {
                // Clearing a hold can perform a release that the hold previously refused
                if let VaultOpOutcome::ReleasePin(hash) =
                    state.data.vault.set_legal_hold(l.file_id, l.legal_hold, l.reference, now)
                {
                    state.data.files.vault_unpin(&hash);
                    state.data.vault.clear_blocked_attempts_for_hash(&hash);
                    info!(file_id = %l.file_id, "Vault: unquarantined on legal-hold clear");
                }
            }
            VaultOp::Destroy(d) => {
                let file_id = d.file_id;
                match state
                    .data
                    .vault
                    .destroy(d.file_id, d.le_request_ref, d.proposed_by, d.confirmed_by, now)
                {
                    VaultOpOutcome::ReleasePin(hash) => {
                        state.data.files.vault_purge(&hash);
                        state.data.vault.clear_blocked_attempts_for_hash(&hash);
                        info!(%file_id, "Vault: destroyed on law enforcement request");
                    }
                    VaultOpOutcome::Blocked => {
                        warn!(%file_id, "Vault: destruction refused - legal hold stands");
                    }
                    _ => {}
                }
            }
            VaultOp::SetReviewers(reviewers) => {
                state.data.vault.set_reviewers(reviewers);
            }
            VaultOp::SetAuthorityReporter(op) => {
                state.data.vault.set_authority_reporter(op.principal, op.oc_public_key_pem);
                info!("Vault: authority reporter updated");
            }
            VaultOp::DenylistHash(d) => {
                // Propagated from the bucket which applied the verdict: blocks uploads of the
                // same content here, and stops any copy already stored here being served
                let derived = d.derived.unwrap_or(false);
                if state.data.vault.denylist_hash(d.hash, d.report_index, derived) {
                    state.data.vault.clear_blocked_attempts_for_hash(&d.hash);
                    info!(report_index = d.report_index, derived, "Vault: CSAM hash denylisted");
                    // A copy of the upheld bytes stored HERE may carry source claims of its own
                    if !derived {
                        denylist_source_hashes(&d.hash, d.report_index, state);
                    }
                }
            }
        }
    }

    crate::jobs::vault_retention::start_job_if_required(state);

    Success(SuccessResult { quarantine_failures })
}

// The bytes behind an upheld hash may be a client-side transcode of some original file (see
// upload_chunk_v2::Args::source_hash): a re-upload of that original transcodes to different
// bytes every time, so the declared original hashes are denylisted too - as DERIVED, since no
// moderator saw those bytes: uploads of them are refused, nobody is sanctioned. Pushed to the
// index so every bucket refuses them; the index dedupes hashes it has already seen.
fn denylist_source_hashes(hash: &types::Hash, report_index: u64, state: &mut RuntimeState) {
    for source_hash in state.data.files.source_hashes(hash) {
        if state.data.vault.denylist_hash(source_hash, report_index, true) {
            state
                .data
                .push_event_to_index(EventToSync::CsamHashDenylisted(CsamHashDenylisted {
                    hash: source_hash,
                    report_index,
                    derived: Some(true),
                }));
            info!(report_index, "Vault: declared source of upheld content denylisted as derived");
        }
    }
}
