use crate::{mutate_state, openchat_bot, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_remove_from_community::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_remove_from_community(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_remove_from_community_impl(args, state))
}

fn c2c_remove_from_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = state.env.caller().into();
    let now = state.env.now();

    if state.data.communities.remove(community_id, now).is_some() {
        openchat_bot::send_removed_from_group_or_community_message(
            false,
            args.removed_by,
            args.community_name,
            args.public,
            args.blocked,
            state,
        );
    }
    Success
}
