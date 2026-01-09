use crate::{CommunityRole, TimestampMillis, UserId, is_default};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMember {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<CommunityRole>", optional)]
    pub role: CommunityRole,
    pub display_name: Option<String>,
    pub referred_by: Option<UserId>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub lapsed: bool,
}
