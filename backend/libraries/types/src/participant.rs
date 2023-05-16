use crate::group_roles::GroupRole;
use crate::TimestampMillis;
use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Participant {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: GroupRole,
}
