use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::CommunityId;
use user_canister::c2c_mark_community_updated_for_user::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_mark_community_updated_for_user(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_mark_community_updated_for_user_impl)
}

fn c2c_mark_community_updated_for_user_impl(state: &mut RuntimeState) -> Response {
    let community_id: CommunityId = state.env.caller().into();
    if let Some(chat) = state.data.communities.get_mut(&community_id) {
        let now = state.env.now();
        chat.last_changed_for_my_data = now;
    }
    Success
}
