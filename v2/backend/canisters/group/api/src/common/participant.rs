use crate::common::role::Role;
use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize)]
pub struct Participant {
    pub user_id: UserId,
    pub principal: Principal,
    pub date_added: TimestampMillis,
    pub role: Role,
    pub read_up_to: MessageIndex,
    pub mute_notifications: bool,
}
