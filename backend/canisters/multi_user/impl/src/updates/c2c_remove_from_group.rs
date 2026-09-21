use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_remove_from_group::*;

#[update(msgpack = true)]
#[trace]
fn c2c_remove_from_group(args: Args) -> Response {
    mutate_state(|state| c2c_remove_from_group_impl(args, state))
}

// Called by the group the user was removed from, so, as in the User canister, the caller is the
// group to remove
fn c2c_remove_from_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.local_user_index(args.user_id) else {
        return Response::Success;
    };
    let now = state.env.now();

    if state.remove_group(user_index, state.env.caller().into(), now).is_some() {
        openchat_bot::send_removed_from_group_or_community_message(
            user_index,
            true,
            args.removed_by,
            args.group_name,
            args.public,
            args.blocked,
            state,
        );
    }
    Response::Success
}
