use crate::CommunityRole;
use crate::TimestampMillis;
use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMember {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: CommunityRole,
    pub display_name: Option<String>,
    pub referred_by: Option<UserId>,
    #[ts(skip_if_default)]
    pub lapsed: bool,
}
