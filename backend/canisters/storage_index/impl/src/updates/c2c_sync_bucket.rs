use crate::guards::caller_is_bucket;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use constants::ONE_GB;
use ic_cdk::update;
use storage_index_canister::c2c_sync_bucket::*;
use user_index_canister::c2c_csam_upload_detected as ui_csam;

#[update(guard = "caller_is_bucket")]
#[trace]
fn c2c_sync_bucket(args: Args) -> Response {
    mutate_state(|state| c2c_sync_bucket_impl(args, state))
}

fn c2c_sync_bucket_impl(args: Args, state: &mut RuntimeState) -> Response {
    let bucket = state.env.caller();

    let files_rejected = args
        .files_added
        .into_iter()
        .filter_map(|file| state.data.add_file_reference(bucket, file).err())
        .collect();

    for file in args.files_removed {
        state.data.remove_file_reference(bucket, file);
    }

    if !args.csam_matches.is_empty() {
        if let Some(user_index) = state.data.user_index_canister_id {
            let forward = user_index_canister::c2c_csam_upload_detected::Args {
                matches: args
                    .csam_matches
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

    if let Some(b) = state.data.buckets.get_mut(&bucket) {
        b.heap_memory_used = args.heap_memory_used;
        b.stable_memory_used = args.stable_memory_used;
        b.total_file_bytes = args.total_file_bytes;
    }

    if args.heap_memory_used >= ONE_GB || args.stable_memory_used >= 40 * ONE_GB {
        state.data.buckets.set_full(bucket, true);
    }

    Response::Success(SuccessResult { files_rejected })
}
