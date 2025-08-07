use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_remove_from_community::*;

#[update(msgpack = true)]
#[trace]
fn c2c_remove_from_community(args: Args) -> Response {
    execute_update(|state| c2c_remove_from_community_impl(args, state))
}

fn c2c_remove_from_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = state.env.caller().into();
    let now = state.env.now();

    if state.data.remove_community(community_id, now).is_some() {
        openchat_bot::send_removed_from_group_or_community_message(
            false,
            args.removed_by,
            args.community_name,
            args.public,
            args.blocked,
            state,
        );
    }
    Response::Success
}
