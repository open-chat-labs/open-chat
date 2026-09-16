use serde::{Deserialize, Serialize};
use types::{ChatId, CommunityId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
    pub groups: Vec<ChatId>,
    pub communities: Vec<CommunityId>,
}
