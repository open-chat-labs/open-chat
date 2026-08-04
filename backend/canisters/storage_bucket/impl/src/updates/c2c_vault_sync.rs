use crate::guards::caller_is_storage_index_canister;
use crate::model::index_event_batch::EventToSync;
use crate::model::vault::VaultOpOutcome;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_vault_sync::{Response::*, *};
use storage_index_canister::c2c_sync_bucket::CsamHashDenylisted;
use tracing::{error, info};

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
                        info!(%file_id, "Vault: unquarantined");
                    }
                    VaultOpOutcome::Retained => {
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
                        state
                            .data
                            .push_event_to_index(EventToSync::CsamHashDenylisted(CsamHashDenylisted { hash, report_index }));
                    }
                    _ => (),
                }
            }
            VaultOp::SetLegalHold(l) => {
                // Clearing a hold can perform a release that the hold previously refused
                if let VaultOpOutcome::ReleasePin(hash) = state.data.vault.set_legal_hold(l.file_id, l.legal_hold, now) {
                    state.data.files.vault_unpin(&hash);
                    info!(file_id = %l.file_id, "Vault: unquarantined on legal-hold clear");
                }
            }
            VaultOp::Destroy(d) => {
                let file_id = d.file_id;
                if let VaultOpOutcome::ReleasePin(hash) = state.data.vault.destroy(d.file_id, d.le_request_ref, now) {
                    state.data.files.vault_purge(&hash);
                    info!(%file_id, "Vault: destroyed on law enforcement request");
                }
            }
            VaultOp::SetReviewers(reviewers) => {
                state.data.vault.set_reviewers(reviewers);
            }
            VaultOp::DenylistHash(d) => {
                // Propagated from the bucket which applied the verdict: blocks uploads of the
                // same content here, and stops any copy already stored here being served
                if state.data.vault.denylist_hash(d.hash, d.report_index) {
                    info!(report_index = d.report_index, "Vault: CSAM hash denylisted");
                }
            }
        }
    }

    crate::jobs::vault_retention::start_job_if_required(state);

    Success(SuccessResult { quarantine_failures })
}
