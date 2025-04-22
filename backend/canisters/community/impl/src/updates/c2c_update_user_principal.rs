use crate::guards::caller_is_user_index;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_update_user_principal::*;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
async fn c2c_update_user_principal(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_update_user_principal_impl(args, state))
}

fn c2c_update_user_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    state
        .data
        .members
        .update_user_principal(args.old_principal, args.new_principal);

    Response::Success
}
