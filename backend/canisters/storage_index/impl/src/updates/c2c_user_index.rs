use crate::guards::caller_is_user_controller;
use crate::updates::add_or_update_users::add_or_update_user;
use crate::updates::remove_users::remove_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_index_canister::UserIndexEvent;
use storage_index_canister::c2c_user_index::*;

#[update(guard = "caller_is_user_controller", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            match event.value {
                UserIndexEvent::AddOrUpdateUser(user_config) => add_or_update_user(user_config, state),
                UserIndexEvent::RemoveUser(user_id) => remove_user(user_id, state),
            }
        }
    }
    Response::Success
}
