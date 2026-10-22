use crate::guards::caller_is_user_controller;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_bucket_canister::StorageIndexEvent;
use storage_index_canister::GroupIndexEvent;
use storage_index_canister::c2c_group_index::*;

// The GroupIndex is one of the user controllers, which is as closely as this canister knows it
#[update(guard = "caller_is_user_controller", msgpack = true)]
#[trace]
fn c2c_group_index(args: Args) -> Response {
    mutate_state(|state| c2c_group_index_impl(args, state))
}

fn c2c_group_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            match event.value {
                GroupIndexEvent::RemoveAccessor(accessor_id) => {
                    state.push_event_to_buckets(StorageIndexEvent::AccessorRemoved(accessor_id))
                }
            }
        }
    }
    Response::Success
}
