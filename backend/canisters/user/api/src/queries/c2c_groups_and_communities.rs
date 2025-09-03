use serde::{Deserialize, Serialize};
use types::{ChatId, CommunityId, Empty};

pub type Args = Empty;

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
    pub groups: Vec<ChatId>,
    pub communities: Vec<CommunityId>,
}
