use crate::group_roles::GroupRole;
use crate::TimestampMillis;
use crate::UserId;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct GroupMember {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: GroupRole,
}
