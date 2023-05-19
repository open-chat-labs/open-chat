use crate::CommunityRole;
use crate::TimestampMillis;
use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMember {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: CommunityRole,
}
