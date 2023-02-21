use crate::guards::caller_is_bucket;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::c2c_sync_bucket::*;

#[update(guard = "caller_is_bucket")]
#[trace]
fn c2c_sync_bucket(args: Args) -> Response {
    mutate_state(|state| c2c_sync_bucket_impl(args, state))
}

fn c2c_sync_bucket_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let bucket = runtime_state.env.caller();

    let files_rejected = args
        .files_added
        .into_iter()
        .filter_map(|file| runtime_state.data.add_file_reference(bucket, file).err())
        .collect();

    for file in args.files_removed {
        runtime_state.data.remove_file_reference(bucket, file);
    }

    if let Some(b) = runtime_state.data.buckets.get_mut(&bucket) {
        b.bytes_used = args.bytes_used;
        b.bytes_remaining = args.bytes_remaining;
    }

    if args.bytes_remaining <= 0 {
        runtime_state.data.buckets.set_full(bucket, true);
    }

    Response::Success(SuccessResult { files_rejected })
}
