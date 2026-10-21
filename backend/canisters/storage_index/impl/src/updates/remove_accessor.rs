use crate::guards::caller_is_user_controller;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::StorageIndexEvent;
use storage_index_canister::remove_accessors::*;

#[update(guard = "caller_is_user_controller")]
#[trace]
fn remove_accessors(args: Args) -> Response {
    mutate_state(|state| remove_accessors_impl(args, state))
}

fn remove_accessors_impl(args: Args, state: &mut RuntimeState) -> Response {
    for accessor_id in args.accessor_ids {
        state.push_event_to_buckets(StorageIndexEvent::AccessorRemoved(accessor_id));
    }
    Response::Success
}
