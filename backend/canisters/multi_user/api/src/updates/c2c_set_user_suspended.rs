use serde::{Deserialize, Serialize};
use types::{ChatId, CommunityId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub suspended: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups: Vec<ChatId>,
    pub communities: Vec<CommunityId>,
}
