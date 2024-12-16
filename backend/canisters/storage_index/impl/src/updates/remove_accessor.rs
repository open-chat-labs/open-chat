use crate::guards::caller_is_user_controller;
use crate::model::bucket_event_batch::EventToSync;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_index_canister::remove_accessor::*;

#[update(guard = "caller_is_user_controller")]
#[trace]
fn remove_accessor(args: Args) -> Response {
    mutate_state(|state| remove_accessor_impl(args, state))
}

fn remove_accessor_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.push_event_to_buckets(EventToSync::AccessorRemoved(args.accessor_id));
    Response::Success
}
