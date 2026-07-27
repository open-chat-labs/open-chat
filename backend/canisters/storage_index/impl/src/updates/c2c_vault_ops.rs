use crate::guards::caller_is_user_controller;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_vault_sync as bucket_vault;
use storage_index_canister::c2c_vault_ops::{Response::*, *};
use types::BlobReference;

// Vault control plane: routes evidence-vault operations to the bucket holding each blob, and
// broadcasts the reviewer allowlist to every bucket. Callable only by a user controller
// (i.e. the user_index, which mediates all authorization).
#[update(guard = "caller_is_user_controller")]
#[trace]
fn c2c_vault_ops(args: Args) -> Response {
    mutate_state(|state| c2c_vault_ops_impl(args, state))
}

fn c2c_vault_ops_impl(args: Args, state: &mut RuntimeState) -> Response {
    for op in args.ops {
        match op {
            VaultOp::Quarantine(q) => {
                let bucket = q.blob_reference.canister_id;
                push(
                    state,
                    bucket,
                    bucket_vault::VaultOp::Quarantine(bucket_vault::QuarantineOp {
                        file_id: q.blob_reference.blob_id,
                        metadata: q.metadata,
                    }),
                );
            }
            VaultOp::Unquarantine(blob_reference) => {
                push_for_blob(
                    state,
                    &blob_reference,
                    bucket_vault::VaultOp::Unquarantine(blob_reference.blob_id),
                );
            }
            VaultOp::ApplyVerdict(v) => {
                push_for_blob(
                    state,
                    &v.blob_reference,
                    bucket_vault::VaultOp::ApplyVerdict(bucket_vault::ApplyVerdictOp {
                        file_id: v.blob_reference.blob_id,
                        retention_until: v.retention_until,
                    }),
                );
            }
            VaultOp::SetLegalHold(l) => {
                push_for_blob(
                    state,
                    &l.blob_reference,
                    bucket_vault::VaultOp::SetLegalHold(bucket_vault::SetLegalHoldOp {
                        file_id: l.blob_reference.blob_id,
                        legal_hold: l.legal_hold,
                    }),
                );
            }
            VaultOp::Destroy(d) => {
                push_for_blob(
                    state,
                    &d.blob_reference,
                    bucket_vault::VaultOp::Destroy(bucket_vault::DestroyOp {
                        file_id: d.blob_reference.blob_id,
                        le_request_ref: d.le_request_ref,
                    }),
                );
            }
            VaultOp::SetReviewers(reviewers) => {
                state.data.vault_reviewers = reviewers.iter().copied().collect();
                let buckets: Vec<_> = state.data.buckets.iter().map(|b| b.canister_id).collect();
                for bucket in buckets {
                    push(state, bucket, bucket_vault::VaultOp::SetReviewers(reviewers.clone()));
                }
            }
        }
    }

    Success
}

fn push_for_blob(state: &mut RuntimeState, blob_reference: &BlobReference, op: bucket_vault::VaultOp) {
    push(state, blob_reference.canister_id, op);
}

fn push(state: &mut RuntimeState, bucket: types::CanisterId, op: bucket_vault::VaultOp) {
    // Defense in depth: never c2c-call a canister we don't recognise as one of our buckets
    if state.data.buckets.get(&bucket).is_none() {
        tracing::error!(%bucket, "Vault op dropped: unknown bucket canister");
        return;
    }
    state.data.vault_event_sync_queue.push(bucket, op);
}
