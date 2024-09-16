use crate::CommunityRole;
use crate::TimestampMillis;
use crate::UserId;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct CommunityMember {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: CommunityRole,
    pub display_name: Option<String>,
    pub referred_by: Option<UserId>,
    pub lapsed: bool,
}
