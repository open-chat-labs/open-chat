use crate::group_roles::GroupRole;
use crate::{TimestampMillis, UserId, is_default};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMember {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<GroupRole>", optional)]
    pub role: GroupRole,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub lapsed: bool,
}
