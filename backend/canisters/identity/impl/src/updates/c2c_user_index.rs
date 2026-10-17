use crate::guards::caller_is_user_index_canister;
use crate::updates::c2c_set_user_identities::set_user_identity;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::UserIndexEvent;
use identity_canister::c2c_user_index::*;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                UserIndexEvent::SetUserIdentity(user) => set_user_identity(user, state),
            }
        }
    }
    Response::Success
}
