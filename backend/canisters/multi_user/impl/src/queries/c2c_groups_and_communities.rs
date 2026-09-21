use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use user_canister::c2c_groups_and_communities::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_groups_and_communities(args: Args) -> Response {
    read_state(|state| {
        state
            .with_user(args.user_id, |user| Response {
                groups: user.group_chats.iter().map(|g| g.chat_id).collect(),
                communities: user.communities.iter().map(|c| c.community_id).collect(),
            })
            .unwrap_or_else(|_| ic_cdk::trap("User not found"))
    })
}
