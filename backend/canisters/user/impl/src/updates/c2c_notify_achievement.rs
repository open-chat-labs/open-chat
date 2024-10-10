use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_achievement::{Response::*, *};

// TODO: Remove this once groups/communities have been updated to use c2c_notify_group|community_canister_events

#[update(msgpack = true)]
#[trace]
fn c2c_notify_achievement(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_achievement_impl(args, state))
}

fn c2c_notify_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.communities.exists(&caller.into()) && !state.data.group_chats.exists(&caller.into()) {
        return CallerNotFound;
    }

    let now = state.env.now();

    let mut awarded = false;

    for achievement in args.achievements {
        awarded |= state.data.award_achievement(achievement, now);
    }

    if awarded {
        state.data.notify_user_index_of_chit(now);
    }

    Success
}
