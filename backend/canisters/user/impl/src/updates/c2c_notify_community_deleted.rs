use crate::guards::caller_is_group_index;
use crate::{mutate_state, openchat_bot, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_community_deleted::{Response::*, *};

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
fn c2c_notify_community_deleted(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_community_deleted_impl(args, state))
}

fn c2c_notify_community_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.communities.remove(args.deleted_community.id, state.env.now());

    openchat_bot::send_community_deleted_message(
        args.deleted_community.deleted_by,
        args.deleted_community.name,
        args.deleted_community.public,
        state,
    );

    Success
}
