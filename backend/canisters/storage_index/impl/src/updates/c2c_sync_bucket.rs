use crate::guards::caller_is_bucket;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use constants::{ONE_GB, ONE_MB};
use ic_cdk::update;
use storage_index_canister::c2c_sync_bucket::*;

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
