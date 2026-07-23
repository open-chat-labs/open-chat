use crate::guards::caller_is_storage_index_canister;
use crate::model::vault::VaultOpOutcome;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_vault_sync::{Response::*, *};
use tracing::info;

#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_vault_sync(args: Args) -> Response {
    mutate_state(|state| c2c_vault_sync_impl(args, state))
}

fn c2c_vault_sync_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    for op in args.ops {
        match op {
            VaultOp::Quarantine(q) => {
                if let Some(hash) = state.data.files.vault_pin(&q.file_id) {
                    state.data.vault.quarantine(q.file_id, hash, q.metadata, now);
                    info!(file_id = %q.file_id, "Vault: quarantined");
                } else {
                    info!(file_id = %q.file_id, "Vault: quarantine failed, file not found");
                }
            }
            VaultOp::Unquarantine(file_id) => {
                if let VaultOpOutcome::ReleasePin(hash) = state.data.vault.unquarantine(file_id, now) {
                    state.data.files.vault_unpin(&hash);
                    info!(%file_id, "Vault: unquarantined");
                }
            }
            VaultOp::ApplyVerdict(v) => {
                state.data.vault.apply_verdict(v.file_id, v.retention_until, now);
            }
            VaultOp::SetLegalHold(l) => {
                state.data.vault.set_legal_hold(l.file_id, l.legal_hold, now);
            }
            VaultOp::Destroy(d) => {
                let file_id = d.file_id;
                if let VaultOpOutcome::ReleasePin(hash) = state.data.vault.destroy(d.file_id, d.le_request_ref, now) {
                    state.data.files.vault_unpin(&hash);
                    info!(%file_id, "Vault: destroyed on law enforcement request");
                }
            }
            VaultOp::SetReviewers(reviewers) => {
                state.data.vault.set_reviewers(reviewers);
            }
        }
    }

    crate::jobs::vault_retention::start_job_if_required(state);

    Success
}
