use crate::guards::caller_is_user_index;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::c2c_set_user_suspended::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_set_user_suspended(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_set_user_suspended_impl(args.suspended, state))
}

fn c2c_set_user_suspended_impl(suspended: bool, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let groups = state.data.group_chats.iter().map(|g| g.chat_id).collect();
    let communities = state.data.communities.iter().map(|c| c.community_id).collect();

    state.data.suspended = Timestamped::new(suspended, now);

    Success(SuccessResult { groups, communities })
}
