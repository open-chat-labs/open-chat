use crate::{RuntimeState, group_events_by_user, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_group_canister_v2::*;

#[update(msgpack = true)]
#[trace]
fn c2c_group_canister_v2(args: Args) -> Response {
    mutate_state(|state| c2c_group_canister_v2_impl(args, state))
}

// As `c2c_group_canister`, applied to each user in turn
fn c2c_group_canister_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    for (user_id, events) in group_events_by_user(args.events) {
        super::c2c_group_canister::handle_user_events(user_id, events, state);
    }
    Response::Success
}
