use crate::guards::caller_is_group_index;
use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_community_deleted::{Response::*, *};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_notify_community_deleted(args: Args) -> Response {
    execute_update(|state| c2c_notify_community_deleted_impl(args, state))
}

fn c2c_notify_community_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.remove_community(args.deleted_community.id, state.env.now());

    openchat_bot::send_community_deleted_message(
        args.deleted_community.deleted_by,
        args.deleted_community.name,
        args.deleted_community.public,
        state,
    );

    Success
}
