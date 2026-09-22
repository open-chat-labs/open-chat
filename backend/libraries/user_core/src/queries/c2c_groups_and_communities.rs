use crate::User;
use user_canister::c2c_groups_and_communities::Response;

pub fn c2c_groups_and_communities(user: &User) -> Response {
    Response {
        groups: user.group_chats.iter().map(|g| g.chat_id).collect(),
        communities: user.communities.iter().map(|c| c.community_id).collect(),
    }
}
