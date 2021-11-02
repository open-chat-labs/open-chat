use crate::{ChatId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct Alert {
    pub id: u32,
    pub timestamp: TimestampMillis,
    pub details: AlertDetails,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum AlertDetails {
    RemovedFromGroup(RemovedFromGroup),
    BlockedFromGroup(RemovedFromGroup),
    GroupDeleted(GroupDeleted),
    DepositReceived(DepositReceived),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct RemovedFromGroup {
    pub chat_id: ChatId,
    pub removed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct GroupDeleted {
    pub chat_id: ChatId,
    pub deleted_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct DepositReceived {}
