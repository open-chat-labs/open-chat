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
    // The vault control plane is only ever driven by the user_index; remember its canister id
    // so bucket-detected CSAM re-uploads can be reported back to it (see c2c_sync_bucket)
    state.data.user_index_canister_id = Some(state.env.caller());

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
            VaultOp::Unquarantine(u) => {
                push_for_blob(
                    state,
                    &u.blob_reference,
                    bucket_vault::VaultOp::Unquarantine(bucket_vault::UnquarantineOp {
                        file_id: u.blob_reference.blob_id,
                        moderator: u.moderator,
                        report_index: u.report_index,
                    }),
                );
            }
            VaultOp::ApplyVerdict(v) => {
                push_for_blob(
                    state,
                    &v.blob_reference,
                    bucket_vault::VaultOp::ApplyVerdict(bucket_vault::ApplyVerdictOp {
                        file_id: v.blob_reference.blob_id,
                        retention_until: v.retention_until,
                        moderator: v.moderator,
                        reanchor: v.reanchor,
                        report_index: v.report_index,
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
                        reference: l.reference,
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
                        proposed_by: d.proposed_by,
                        confirmed_by: d.confirmed_by,
                    }),
                );
            }
            VaultOp::SetReviewers(reviewers) => {
                state.data.vault_reviewers = reviewers.clone();
                let bucket_reviewers: Vec<_> = reviewers
                    .iter()
                    .map(|r| bucket_vault::VaultReviewer {
                        principal: r.principal,
                        user_id: r.user_id,
                    })
                    .collect();
                let buckets: Vec<_> = state.data.buckets.iter().map(|b| b.canister_id).collect();
                for bucket in buckets {
                    push(state, bucket, bucket_vault::VaultOp::SetReviewers(bucket_reviewers.clone()));
                }
            }
            VaultOp::SetAuthorityReporter(op) => {
                // Kept in index state so each NEW bucket is seeded with it too (add_bucket)
                state.data.authority_reporter = Some(op.clone());
                let buckets: Vec<_> = state.data.buckets.iter().map(|b| b.canister_id).collect();
                for bucket in buckets {
                    push(
                        state,
                        bucket,
                        bucket_vault::VaultOp::SetAuthorityReporter(bucket_vault::SetAuthorityReporterOp {
                            principal: op.principal,
                            oc_public_key_pem: op.oc_public_key_pem.clone(),
                        }),
                    );
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
