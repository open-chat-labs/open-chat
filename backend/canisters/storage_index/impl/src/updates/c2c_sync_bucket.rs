use crate::guards::caller_is_bucket;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use constants::ONE_GB;
use ic_cdk::update;
use storage_index_canister::c2c_sync_bucket::*;
use types::{CanisterId, FileAdded};
use user_index_canister::c2c_csam_upload_detected as ui_csam;

// Being replaced by `c2c_storage_bucket`, which takes the same events in idempotent envelopes. Served
// until every bucket sends there.
#[update(guard = "caller_is_bucket")]
#[trace]
fn c2c_sync_bucket(args: Args) -> Response {
    mutate_state(|state| c2c_sync_bucket_impl(args, state))
}

fn c2c_sync_bucket_impl(args: Args, state: &mut RuntimeState) -> Response {
    let bucket = state.env.caller();
    let now = state.env.now();

    for file in &args.files_added {
        repush_denylist_if_hash_known(bucket, file, state);
    }

    let files_rejected = args
        .files_added
        .into_iter()
        .filter_map(|file| state.data.add_file_reference(bucket, file, now, state.env.rng()).err())
        .collect();

    for file in args.files_removed {
        state.data.remove_file_reference(bucket, file);
    }

    for denylisted in args.csam_hashes_denylisted {
        state.data.denylist_csam_hash(
            bucket,
            denylisted.hash,
            denylisted.report_index,
            denylisted.derived.unwrap_or(false),
            now,
            state.env.rng(),
        );
    }

    forward_csam_matches(bucket, args.csam_matches, state);

    update_bucket_figures(
        bucket,
        args.heap_memory_used,
        args.stable_memory_used,
        args.total_file_bytes,
        state,
    );

    Response::Success(SuccessResult { files_rejected })
}

// Shared with `c2c_storage_bucket`

// A file arriving with a hash already upheld as CSAM means this bucket has not applied the denylist -
// it was uploaded before the op landed, or the op was dropped. Re-push it: the bucket then refuses to
// serve the bytes and blocks any further upload of them.
pub(crate) fn repush_denylist_if_hash_known(bucket: CanisterId, file: &FileAdded, state: &mut RuntimeState) {
    let verified = state.data.csam_hashes.get(&file.hash).map(|r| (*r, false));
    let derived = state.data.derived_csam_hashes.get(&file.hash).map(|r| (*r, true));
    if let Some((report_index, derived)) = verified.or(derived) {
        tracing::error!(%bucket, report_index, derived, "File uploaded with a denylisted hash; re-pushing the denylist");
        let now = state.env.now();
        state
            .data
            .push_denylisted_hash_to_bucket(bucket, file.hash, report_index, derived, now, state.env.rng());
    }
}

pub(crate) fn forward_csam_matches(bucket: CanisterId, matches: Vec<CsamMatch>, state: &mut RuntimeState) {
    if !matches.is_empty() {
        if let Some(user_index) = state.data.user_index_canister_id {
            let forward = user_index_canister::c2c_csam_upload_detected::Args {
                matches: matches
                    .into_iter()
                    .map(|m| ui_csam::CsamUploadMatch {
                        uploader: m.uploader,
                        bucket,
                        file_id: m.file_id,
                        hash: m.hash,
                        csam_report_index: m.csam_report_index,
                        kind: match m.kind {
                            CsamMatchKind::UploadAttempt => ui_csam::CsamMatchKind::UploadAttempt,
                            CsamMatchKind::ForwardAttempt => ui_csam::CsamMatchKind::ForwardAttempt,
                            CsamMatchKind::PendingQuarantineAttempt => ui_csam::CsamMatchKind::PendingQuarantineAttempt,
                            CsamMatchKind::ExistingCopy => ui_csam::CsamMatchKind::ExistingCopy,
                        },
                    })
                    .collect(),
            };
            state.data.fire_and_forget_handler.send(
                user_index,
                "c2c_csam_upload_detected_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&forward),
            );
        } else {
            // Can only happen before the user_index has ever driven a vault op; loud because
            // a dropped match means a re-upload of known CSAM content goes unreported
            tracing::error!("CSAM upload match dropped: user_index canister id not yet known");
        }
    }
}

pub(crate) fn update_bucket_figures(
    bucket: CanisterId,
    heap_memory_used: u64,
    stable_memory_used: u64,
    total_file_bytes: u64,
    state: &mut RuntimeState,
) {
    if let Some(b) = state.data.buckets.get_mut(&bucket) {
        b.heap_memory_used = heap_memory_used;
        b.stable_memory_used = stable_memory_used;
        b.total_file_bytes = total_file_bytes;
    }

    if heap_memory_used >= ONE_GB || stable_memory_used >= 40 * ONE_GB {
        state.data.buckets.set_full(bucket, true);
    }
}
