use crate::User;
use user_canister::c2c_groups_and_communities::Response;

pub fn c2c_groups_and_communities(user: &User) -> Response {
    Response {
        groups: user.group_chats.ids().collect(),
        communities: user.communities.ids().collect(),
    }
}
