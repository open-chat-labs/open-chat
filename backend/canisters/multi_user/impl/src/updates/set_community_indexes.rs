use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_community_indexes::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_community_indexes(args: Args) -> Response {
    execute_update(|state| set_community_indexes_impl(args, state))
}

fn set_community_indexes_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user_core::updates::set_community_indexes(user, args, now));
    Response::Success
}
