use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::UserId;

#[derive(CandidType, Deserialize)]
pub struct Participant {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub is_admin: bool,
}
