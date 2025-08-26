use crate::guards::caller_is_user_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::c2c_set_user_ids::*;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_set_user_ids(args: Args) -> Response {
    // This function runs in O(number of users registered x batch size),
    // so we need to ensure each batch is fairly small
    assert!(args.users.len() <= 100);

    mutate_state(|state| c2c_set_user_ids_impl(args, state))
}

fn c2c_set_user_ids_impl(args: Args, state: &mut RuntimeState) -> Response {
    for (principal, user_id) in args.users {
        state.data.user_principals.set_user_id(principal, user_id);
    }

    Response::Success
}
