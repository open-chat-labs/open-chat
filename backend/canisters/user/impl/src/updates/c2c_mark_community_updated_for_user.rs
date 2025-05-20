use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::CommunityId;
use user_canister::c2c_mark_community_updated_for_user::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn c2c_mark_community_updated_for_user(_args: Args) -> Response {
    execute_update(c2c_mark_community_updated_for_user_impl)
}

fn c2c_mark_community_updated_for_user_impl(state: &mut RuntimeState) -> Response {
    let community_id: CommunityId = state.env.caller().into();
    if let Some(chat) = state.data.communities.get_mut(&community_id) {
        let now = state.env.now();
        chat.last_changed_for_my_data = now;
    }
    Success
}
