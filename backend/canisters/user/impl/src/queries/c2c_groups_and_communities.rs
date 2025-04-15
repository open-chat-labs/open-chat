use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use user_canister::c2c_groups_and_communities::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_groups_and_communities(_args: Args) -> Response {
    read_state(|state| {
        let groups = state.data.group_chats.iter().map(|g| g.chat_id).collect();
        let communities = state.data.communities.iter().map(|c| c.community_id).collect();

        Response { groups, communities }
    })
}
