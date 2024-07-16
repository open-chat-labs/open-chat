use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::{ChatId, CommunityId};
use user_canister::c2c_notify_achievement::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_notify_achievement(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_achievement_impl(args, state))
}

fn c2c_notify_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id: CommunityId = state.env.caller().into();
    let group_id: ChatId = state.env.caller().into();

    if !state.data.communities.exists(&community_id) && !state.data.group_chats.exists(&group_id) {
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
