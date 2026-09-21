use crate::guards::caller_is_group_index;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_community_deleted::*;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_notify_community_deleted(args: Args) -> Response {
    mutate_state(|state| c2c_notify_community_deleted_impl(args, state))
}

fn c2c_notify_community_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.local_user_index(args.user_id) else {
        return Response::Success;
    };
    let now = state.env.now();

    state.remove_community(user_index, args.deleted_community.id, now);

    openchat_bot::send_community_deleted_message(
        user_index,
        args.deleted_community.deleted_by,
        args.deleted_community.name,
        args.deleted_community.public,
        state,
    );

    Response::Success
}
