use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummary {
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    // TODO: Remove this once the website no longer expects this
    pub seconds_since_last_online: u32,
    pub diamond_member: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialUserSummary {
    pub user_id: UserId,
    pub username: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_member: bool,
}

// TODO: Remove this once the website is using users_v2
impl From<UserSummary> for PartialUserSummary {
    fn from(summary: UserSummary) -> Self {
        PartialUserSummary {
            user_id: summary.user_id,
            username: Some(summary.username),
            avatar_id: summary.avatar_id,
            is_bot: summary.is_bot,
            suspended: summary.suspended,
            diamond_member: summary.diamond_member,
        }
    }
}
